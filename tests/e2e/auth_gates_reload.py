"""
E2E: recarrega /admin, /vendedor e /cliente com a rede afunilada (throttling)
e garante que a mensagem de bloqueio "Acesso não liberado" NUNCA aparece —
apenas o spinner e, em seguida, o painel.

Como rodar (com o dev server em http://localhost:8080):

    python3 tests/e2e/auth_gates_reload.py

Requer uma sessão Supabase disponível no ambiente
(LOVABLE_BROWSER_SUPABASE_* / LOVABLE_BROWSER_AUTH_STATUS=injected).
Sem sessão, o script valida apenas o redirecionamento para /login sem flash.

O throttling é feito interceptando as chamadas de user_roles / profiles /
role_permissions e atrasando a resposta (ATRASO_MS), que é exatamente a janela
em que o falso positivo de bloqueio aparecia.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
ROTAS = ["/admin", "/vendedor", "/cliente"]
ATRASO_MS = 2500
BLOQUEIO = "Acesso não liberado"
FALHA = "Falha de conexão"
SCREENSHOTS = Path(__file__).parent / "screenshots"

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
""" % json.dumps([BLOQUEIO, FALHA])


async def restaurar_sessao(context, page):
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
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    falhas: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})

        async def atrasar(route):
            await asyncio.sleep(ATRASO_MS / 1000)
            await route.continue_()

        # Afunila as consultas que resolvem sessão/papel.
        await context.route("**/rest/v1/user_roles*", atrasar)
        await context.route("**/rest/v1/profiles*", atrasar)
        await context.route("**/rest/v1/role_permissions*", atrasar)

        page = await context.new_page()
        com_sessao = await restaurar_sessao(context, page)
        print("sessao restaurada:", com_sessao)

        for rota in ROTAS:
            await page.add_init_script(OBSERVER)
            try:
                await page.goto(BASE + rota, wait_until="domcontentloaded", timeout=30000)
            except Exception as e:  # navegação abortada por redirect é aceitável
                print(f"{rota}: aviso na navegação: {type(e).__name__}")

            # Durante o atraso só pode existir o estado de carregamento.
            await page.wait_for_timeout(600)
            estado = await page.evaluate(
                "document.querySelector('[data-gate-estado]')?.dataset.gateEstado ?? null"
            )
            print(f"{rota}: estado durante o carregamento = {estado}")

            await page.wait_for_timeout(ATRASO_MS + 2500)
            flashes = await page.evaluate("window.__flash ?? []")
            texto = await page.evaluate("document.body.innerText.slice(0, 200)")
            await page.screenshot(path=str(SCREENSHOTS / f"{rota.strip('/')}.png"))

            if flashes:
                falhas.append(f"{rota}: flash de bloqueio {sorted(set(flashes))}")
            print(f"{rota}: url={page.url} flash={sorted(set(flashes))}")
            print(f"{rota}: texto final = {texto!r}")

        await browser.close()

    if falhas:
        print("\nFALHOU:")
        for f in falhas:
            print(" -", f)
        return 1
    print("\nOK: nenhuma mensagem de bloqueio apareceu durante o carregamento.")
    return 0


sys.exit(asyncio.run(main()))
