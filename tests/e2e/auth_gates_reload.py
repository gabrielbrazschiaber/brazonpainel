"""
E2E dos gates de acesso do BRAZON — conjunto CRÍTICO de rotas.

Objetivo: detectar flash dos textos de bloqueio ("Acesso não liberado" /
"Falha de conexão") gastando o mínimo de tempo de pipeline. Em vez de varrer
todas as rotas, rodamos uma matriz enxuta cobrindo:

  * cada papel (admin, vendedor, cliente) e o caso anônimo;
  * cada TIPO de navegação (reload = SSR + hidratação; spa = navegação interna
    sem reload; troca de conta = sessão substituída sem reload).

Rotas extras só entram com E2E_ROTAS=todas (execução noturna/manual).

Rastreabilidade ponta a ponta: cada execução gera um TRACE ID único, injetado
em `window.__brazonTraceId` antes do carregamento. O mesmo valor é gravado em
`auth_telemetria.trace_id` e exportado para o destino externo, e nomeia todos
os artefatos (vídeo, screenshot, dump de HTML, telemetria). Basta procurar o
trace para ligar o incidente ao vídeo.

Como rodar (dev server em http://localhost:8080):

    python3 tests/e2e/auth_gates_reload.py

Sem sessão Supabase no ambiente (LOVABLE_BROWSER_AUTH_STATUS != injected) o
script valida apenas o fluxo anônimo (redirecionamento para /login sem flash).
"""

import asyncio
import json
import os
import re
import sys
import uuid
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
ATRASO_MS = 2500
RAIZ = Path(__file__).resolve().parents[2]
GATE_TEXTOS_TS = RAIZ / "src" / "lib" / "gate-textos.ts"

# Trace único da execução: nomeia artefatos e casa com auth_telemetria.trace_id.
TRACE_ID = os.environ.get("E2E_TRACE_ID") or f"e2e-{uuid.uuid4()}"
ARTIFACTS = Path(__file__).parent / "artifacts" / TRACE_ID

# ---------------------------------------------------------------- matriz de rotas
# nav: "reload" (carregamento completo) | "spa" (navegação interna, sem reload)
ROTAS_CRITICAS = [
    {"rota": "/admin", "papel": "admin", "nav": "reload"},
    {"rota": "/vendedor", "papel": "vendedor", "nav": "reload"},
    {"rota": "/cliente", "papel": "cliente", "nav": "reload"},
    {"rota": "/tarefas", "papel": "compartilhada", "nav": "spa"},
    {"rota": "/comercial", "papel": "vendedor", "nav": "spa"},
]

# Cobertura ampliada (não roda no CI de cada push).
ROTAS_EXTRAS = [
    {"rota": "/solicitacoes", "papel": "cliente", "nav": "reload"},
    {"rota": "/meus-aceites", "papel": "compartilhada", "nav": "spa"},
    {"rota": "/", "papel": "compartilhada", "nav": "reload"},
]

TODAS = os.environ.get("E2E_ROTAS", "criticas").lower() in {"todas", "all", "full"}
ROTAS = ROTAS_CRITICAS + (ROTAS_EXTRAS if TODAS else [])


def textos_de_bloqueio() -> list[str]:
    """Lê os títulos dos gates direto do módulo TS: fonte única com a interface."""
    fonte = GATE_TEXTOS_TS.read_text(encoding="utf-8")
    titulos = re.findall(r"titulo:\s*\"([^\"]+)\"", fonte)
    if not titulos:
        raise SystemExit(f"não encontrei títulos de gate em {GATE_TEXTOS_TS}")
    return titulos


BLOQUEIOS = textos_de_bloqueio()

# Injeta o trace ANTES de qualquer script da app e observa o DOM em busca dos
# textos de bloqueio (inclusive os que aparecem por milissegundos).
OBSERVER = """
window.__brazonTraceId = %s;
try { window.localStorage.setItem('brazon:trace-id', window.__brazonTraceId); } catch (e) {}
window.__flash = [];
const alvo = %s;
const check = () => {
  const t = document.body ? document.body.innerText : '';
  for (const frase of alvo) if (t.includes(frase)) window.__flash.push(frase);
};
new MutationObserver(check).observe(document.documentElement,
  { subtree: true, childList: true, characterData: true });
check();
""" % (json.dumps(TRACE_ID), json.dumps(BLOQUEIOS))


async def capturar_evidencias(page, nome: str) -> list[str]:
    """Screenshot + dump de HTML + telemetria do momento da detecção."""
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    caminhos = []
    png = ARTIFACTS / f"{nome}.png"
    await page.screenshot(path=str(png))
    caminhos.append(str(png))

    html = ARTIFACTS / f"{nome}.html"
    html.write_text(await page.content(), encoding="utf-8")
    caminhos.append(str(html))

    telemetria = await page.evaluate("window.__brazonAuthTelemetry ?? []")
    tel = ARTIFACTS / f"{nome}.telemetria.json"
    tel.write_text(
        json.dumps({"trace_id": TRACE_ID, "eventos": telemetria}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    caminhos.append(str(tel))
    return caminhos


def sessao_env(sufixo: str = "") -> tuple[str | None, str | None, str | None]:
    return (
        os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY" + sufixo),
        os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON" + sufixo),
        os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON" + sufixo),
    )


async def restaurar_sessao(context, page, sufixo: str = "") -> bool:
    storage_key, session_json, cookies_json = sessao_env(sufixo)
    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE
        await context.add_cookies(cookies)
    await page.goto(BASE, wait_until="domcontentloaded")
    if storage_key and session_json:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )
        return True
    return False


async def navegar(page, rota: str, nav: str) -> str:
    """Executa a navegação do tipo pedido. Devolve o tipo realmente usado."""
    if nav == "spa":
        seletor = f'a[href="{rota}"], a[href^="{rota}?"]'
        link = page.locator(seletor).first
        try:
            if await link.count() > 0:
                await link.click(timeout=5000)
                return "spa"
        except Exception:
            pass
        # Sem link visível (papel sem permissão, menu recolhido): cai para reload.
        nav = "reload"
    try:
        await page.goto(BASE + rota, wait_until="domcontentloaded", timeout=30000)
    except Exception as e:  # redirect pode abortar a navegação
        print(f"{rota}: aviso na navegação: {type(e).__name__}")
    return nav


async def cenario_rotas(context, com_sessao: bool) -> list[str]:
    falhas: list[str] = []
    page = await context.new_page()
    await page.add_init_script(OBSERVER)
    await restaurar_sessao(context, page)

    for caso in ROTAS:
        rota, papel, nav = caso["rota"], caso["papel"], caso["nav"]
        nome = f"{nav}_{papel}_{rota.strip('/') or 'raiz'}"
        await page.evaluate("window.__flash = []")
        usado = await navegar(page, rota, nav)

        await page.wait_for_timeout(600)
        estado = await page.evaluate(
            "document.querySelector('[data-gate-estado]')?.dataset.gateEstado ?? null"
        )
        flash_precoce = await page.evaluate("window.__flash ?? []")
        if flash_precoce:
            arqs = await capturar_evidencias(page, nome + "_flash")
            falhas.append(
                f"{rota} [{papel}/{usado}]: flash {sorted(set(flash_precoce))} — evidências: {arqs}"
            )

        await page.wait_for_timeout(ATRASO_MS + 2500)
        flashes = await page.evaluate("window.__flash ?? []")
        if flashes and not flash_precoce:
            arqs = await capturar_evidencias(page, nome + "_flash")
            falhas.append(
                f"{rota} [{papel}/{usado}]: flash {sorted(set(flashes))} — evidências: {arqs}"
            )
        else:
            await page.screenshot(path=str(ARTIFACTS / f"{nome}.png"))
        print(
            f"{rota} [{papel}/{usado}] estado={estado} url={page.url} "
            f"flash={sorted(set(flashes))} sessao={com_sessao}"
        )

    await page.close()
    return falhas


async def cenario_troca_de_conta(context) -> list[str]:
    """Sai da conta e entra novamente (outra sessão se houver _2) sem reload."""
    storage_key, session_json, _ = sessao_env()
    if not (storage_key and session_json):
        print("troca de conta: sem sessão no ambiente, cenário ignorado")
        return []

    _, sessao_alvo, _ = sessao_env("_2")
    sessao_alvo = sessao_alvo or session_json

    falhas: list[str] = []
    page = await context.new_page()
    await page.add_init_script(OBSERVER)
    await restaurar_sessao(context, page)
    await page.goto(BASE + "/admin", wait_until="domcontentloaded")
    await page.wait_for_timeout(3000)

    # Troca a sessão no storage e avisa o cliente Supabase (evento de storage).
    await page.evaluate(
        """([k, v]) => {
             window.localStorage.setItem(k, v);
             window.dispatchEvent(new StorageEvent('storage', { key: k, newValue: v }));
           }""",
        [storage_key, sessao_alvo],
    )
    await page.wait_for_timeout(4000)

    flashes = await page.evaluate("window.__flash ?? []")
    if flashes:
        arqs = await capturar_evidencias(page, "troca_conta_flash")
        falhas.append(f"troca de conta: flash {sorted(set(flashes))} — evidências: {arqs}")
    else:
        await page.screenshot(path=str(ARTIFACTS / "troca_conta.png"))
    print(f"troca de conta: url={page.url} flash={sorted(set(flashes))}")
    await page.close()
    return falhas


async def main() -> int:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    falhas: list[str] = []
    print(f"TRACE ID desta execução: {TRACE_ID}")
    print("conjunto de rotas:", "todas" if TODAS else "críticas", f"({len(ROTAS)} rotas)")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 1800},
            record_video_dir=str(ARTIFACTS / "video"),
            record_video_size={"width": 1280, "height": 900},
        )

        async def atrasar(route):
            await asyncio.sleep(ATRASO_MS / 1000)
            await route.continue_()

        # Captura o que o app EXPORTA para o destino externo de telemetria.
        # O CI valida depois (bun run validar:telemetria) que todo evento leva
        # trace_id, versão e rota — o mesmo contrato do destino real.
        exportados: list[dict] = []

        async def capturar_exportacao(route):
            try:
                dados = route.request.post_data_json
                if isinstance(dados, list):
                    exportados.extend(dados)
                elif isinstance(dados, dict):
                    exportados.append(dados)
            except Exception as erro:  # nunca derruba o teste por causa disso
                print("aviso: não foi possível ler o lote exportado:", erro)
            await route.fulfill(status=200, body="{}", content_type="application/json")

        await context.route("**/telemetria-e2e*", capturar_exportacao)

        await context.route("**/rest/v1/user_roles*", atrasar)
        await context.route("**/rest/v1/profiles*", atrasar)
        await context.route("**/rest/v1/role_permissions*", atrasar)

        aquecimento = await context.new_page()
        await aquecimento.add_init_script(OBSERVER)
        com_sessao = await restaurar_sessao(context, aquecimento)
        await aquecimento.close()
        print("sessao restaurada:", com_sessao, "| textos vigiados:", BLOQUEIOS)

        falhas += await cenario_rotas(context, com_sessao)
        falhas += await cenario_troca_de_conta(context)

        await context.close()  # necessário para finalizar os vídeos
        await browser.close()

    (ARTIFACTS / "telemetria-exportada.json").write_text(
        json.dumps(exportados, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"eventos de telemetria exportados capturados: {len(exportados)}")

    resumo = {
        "trace_id": TRACE_ID,
        "conjunto": "todas" if TODAS else "criticas",
        "rotas": ROTAS,
        "falhas": falhas,
    }
    (ARTIFACTS / "resumo.json").write_text(
        json.dumps(resumo, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    if falhas:
        print("\nFALHOU:")
        for f in falhas:
            print(" -", f)
        print(f"\nTrace {TRACE_ID} — vídeos e dumps em {ARTIFACTS}")
        print("Consulte a telemetria filtrando trace_id =", TRACE_ID)
        return 1
    print(f"\nOK: nenhuma mensagem de bloqueio apareceu (trace {TRACE_ID}).")
    return 0


sys.exit(asyncio.run(main()))
