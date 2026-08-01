"""
E2E CRÍTICO do painel admin do BRAZON.

Objetivo: garantir que /admin carrega para o papel admin e que NÃO acontece
erro de React em runtime — em especial o #310 (ordem de hooks), que derrubava
a tela inteira com "Esta página não carregou".

O que reprova a execução:
  * erro de React no console (#310 e afins / "Minified React error");
  * fallback global "Esta página não carregou";
  * fallback do limite de erro do admin ([data-admin-erro]);
  * o painel não renderizar seu conteúdo (nenhuma aba/menu de administração).

Rastreabilidade: a execução usa um TRACE ID único, injetado em
`window.__brazonTraceId` antes de qualquer script da app. Em qualquer falha
gravamos screenshot + dump de HTML + console + telemetria com esse MESMO trace,
na pasta tests/e2e/artifacts/<trace>/, para casar com `auth_telemetria.trace_id`
e com o código mostrado na tela de fallback.

Como rodar (dev server em http://localhost:8080):

    python3 tests/e2e/admin_painel.py

Sem sessão de admin no ambiente (LOVABLE_BROWSER_SUPABASE_* ausentes) o script
não reprova o build: registra que o cenário foi ignorado e sai com 0.
"""

import asyncio
import json
import os
import sys
import uuid
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
TRACE_ID = os.environ.get("E2E_TRACE_ID") or f"e2e-admin-{uuid.uuid4()}"
ARTIFACTS = Path(__file__).parent / "artifacts" / TRACE_ID

ERRO_GLOBAL = "Esta página não carregou"
PADROES_REACT = ("Minified React error", "Error #310", "error #310", "Rendered more hooks")

OBSERVER = """
window.__brazonTraceId = %s;
try { window.localStorage.setItem('brazon:trace-id', window.__brazonTraceId); } catch (e) {}
window.__erros = [];
window.addEventListener('error', (e) => window.__erros.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__erros.push(String(e.reason)));
""" % json.dumps(TRACE_ID)


async def evidencias(page, nome: str, console: list[str]) -> list[str]:
    """Screenshot + HTML + console + telemetria, todos com o mesmo Trace ID."""
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    caminhos = []

    png = ARTIFACTS / f"{nome}.png"
    await page.screenshot(path=str(png))
    caminhos.append(str(png))

    html = ARTIFACTS / f"{nome}.html"
    html.write_text(await page.content(), encoding="utf-8")
    caminhos.append(str(html))

    dump = ARTIFACTS / f"{nome}.dump.json"
    try:
        telemetria = await page.evaluate("window.__brazonAuthTelemetry ?? []")
        erros_janela = await page.evaluate("window.__erros ?? []")
        trace_na_tela = await page.evaluate(
            "document.querySelector('[data-admin-erro]')?.dataset.traceId ?? null"
        )
    except Exception:
        telemetria, erros_janela, trace_na_tela = [], [], None
    dump.write_text(
        json.dumps(
            {
                "trace_id": TRACE_ID,
                "trace_id_na_tela": trace_na_tela,
                "url": page.url,
                "console": console,
                "erros_window": erros_janela,
                "telemetria": telemetria,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    caminhos.append(str(dump))
    return caminhos


async def restaurar_sessao(context, page) -> bool:
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

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


async def main() -> int:
    print(f"TRACE ID desta execução: {TRACE_ID}")
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    falhas: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 1800},
            record_video_dir=str(ARTIFACTS / "video"),
            record_video_size={"width": 1280, "height": 900},
        )
        page = await context.new_page()
        await page.add_init_script(OBSERVER)

        console: list[str] = []
        page.on(
            "console",
            lambda m: console.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None,
        )
        page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))

        tem_sessao = await restaurar_sessao(context, page)
        if not tem_sessao:
            print("sem sessão de admin no ambiente — cenário ignorado")
            await browser.close()
            return 0

        await page.goto(BASE + "/admin", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(6000)

        texto = await page.evaluate("document.body ? document.body.innerText : ''")
        erros_react = [c for c in console if any(p in c for p in PADROES_REACT)]
        fallback_admin = await page.locator("[data-admin-erro]").count()
        # O painel carregou de verdade? procuramos a navegação de administração.
        conteudo_ok = await page.locator('[data-tour="nav-conta"], [role="tablist"]').count() > 0

        if erros_react:
            falhas.append(f"erro de React no /admin: {erros_react}")
        if ERRO_GLOBAL in texto:
            falhas.append(f'fallback global "{ERRO_GLOBAL}" no /admin')
        if fallback_admin:
            trace_tela = await page.evaluate(
                "document.querySelector('[data-admin-erro]')?.dataset.traceId ?? null"
            )
            falhas.append(f"limite de erro do admin acionado (trace na tela: {trace_tela})")
        if not conteudo_ok:
            falhas.append("painel admin não renderizou navegação/abas")

        nome = "admin_falha" if falhas else "admin_ok"
        arqs = await evidencias(page, nome, console)
        print(f"/admin url={page.url} evidências={arqs}")

        await page.close()
        await browser.close()

    if falhas:
        print("\nFALHAS:")
        for f in falhas:
            print(" -", f)
        print(f"\nTrace ID para investigação: {TRACE_ID} (artefatos em {ARTIFACTS})")
        return 1

    print("painel admin carregou sem erro de React.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
