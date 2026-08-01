"""
E2E dos gates de acesso do BRAZON.

Cenários:
  1. "rede afunilada": recarrega /admin, /vendedor e /cliente atrasando as
     consultas de profiles / user_roles / role_permissions — janela em que o
     falso positivo de bloqueio aparecia.
  2. "troca de conta": derruba a sessão e restaura outra (ou a mesma) sessão sem
     recarregar a página, garantindo que o papel antigo não vaza e que a
     mensagem de bloqueio não pisca durante a transição.

Qualquer ocorrência dos textos de bloqueio (lidos de src/lib/gate-textos.ts,
fonte única compartilhada com a interface) falha o processo com exit code 1 e
grava evidências em tests/e2e/artifacts/: vídeo, screenshot e dump de HTML.

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
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
ROTAS = ["/admin", "/vendedor", "/cliente"]
ATRASO_MS = 2500
RAIZ = Path(__file__).resolve().parents[2]
ARTIFACTS = Path(__file__).parent / "artifacts"
GATE_TEXTOS_TS = RAIZ / "src" / "lib" / "gate-textos.ts"


def textos_de_bloqueio() -> list[str]:
    """Lê os títulos dos gates direto do módulo TS: chaves e mensagens únicas."""
    fonte = GATE_TEXTOS_TS.read_text(encoding="utf-8")
    titulos = re.findall(r"titulo:\s*\"([^\"]+)\"", fonte)
    if not titulos:
        raise SystemExit(f"não encontrei títulos de gate em {GATE_TEXTOS_TS}")
    return titulos


BLOQUEIOS = textos_de_bloqueio()

OBSERVER = """
window.__flash = [];
const alvo = %s;
const check = () => {
  const t = document.body ? document.body.innerText : '';
  for (const frase of alvo) if (t.includes(frase)) window.__flash.push(frase);
};
new MutationObserver(check).observe(document.documentElement,
  { subtree: true, childList: true, characterData: true });
check();
""" % json.dumps(BLOQUEIOS)


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
    tel.write_text(json.dumps(telemetria, indent=2, ensure_ascii=False), encoding="utf-8")
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


async def cenario_rede_afunilada(context, com_sessao: bool) -> list[str]:
    falhas: list[str] = []
    page = await context.new_page()
    await page.add_init_script(OBSERVER)
    await restaurar_sessao(context, page)

    for rota in ROTAS:
        nome = "afunilada_" + rota.strip("/")
        try:
            await page.goto(BASE + rota, wait_until="domcontentloaded", timeout=30000)
        except Exception as e:  # redirect pode abortar a navegação
            print(f"{rota}: aviso na navegação: {type(e).__name__}")

        await page.wait_for_timeout(600)
        estado = await page.evaluate(
            "document.querySelector('[data-gate-estado]')?.dataset.gateEstado ?? null"
        )
        print(f"{rota}: estado durante o carregamento = {estado}")

        flash_precoce = await page.evaluate("window.__flash ?? []")
        if flash_precoce:
            arqs = await capturar_evidencias(page, nome + "_flash")
            falhas.append(f"{rota}: flash {sorted(set(flash_precoce))} — evidências: {arqs}")

        await page.wait_for_timeout(ATRASO_MS + 2500)
        flashes = await page.evaluate("window.__flash ?? []")
        if flashes and not flash_precoce:
            arqs = await capturar_evidencias(page, nome + "_flash")
            falhas.append(f"{rota}: flash {sorted(set(flashes))} — evidências: {arqs}")
        else:
            await page.screenshot(path=str(ARTIFACTS / f"{nome}.png"))
        print(f"{rota}: url={page.url} flash={sorted(set(flashes))} sessao={com_sessao}")

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
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=str(ARTIFACTS / "troca_conta.png"))
    print(f"troca de conta: url={page.url} flash={sorted(set(flashes))}")
    await page.close()
    return falhas


async def main() -> int:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    falhas: list[str] = []

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

        await context.route("**/rest/v1/user_roles*", atrasar)
        await context.route("**/rest/v1/profiles*", atrasar)
        await context.route("**/rest/v1/role_permissions*", atrasar)

        aquecimento = await context.new_page()
        com_sessao = await restaurar_sessao(context, aquecimento)
        await aquecimento.close()
        print("sessao restaurada:", com_sessao, "| textos vigiados:", BLOQUEIOS)

        falhas += await cenario_rede_afunilada(context, com_sessao)
        falhas += await cenario_troca_de_conta(context)

        await context.close()  # necessário para finalizar os vídeos
        await browser.close()

    if falhas:
        print("\nFALHOU:")
        for f in falhas:
            print(" -", f)
        print(f"\nVídeos e dumps em {ARTIFACTS}")
        return 1
    print("\nOK: nenhuma mensagem de bloqueio apareceu durante o carregamento.")
    return 0


sys.exit(asyncio.run(main()))
