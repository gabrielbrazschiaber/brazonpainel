"""
E2E dos tours guiados de onboarding do BRAZON.

Cobre, para cada papel (admin, vendedor, cliente), com as contas demo:
  1. Reset do(s) tutorial(is) SEMPRE pela UI (AjudaDaTela -> "Rever tutorial
     desta tela" / "Rever todos os tutoriais"), nunca escrevendo direto no
     banco — simula um usuário "zerado" para aquela tela.
  2. Primeira visita de cada rota crítica do papel mostra o overlay
     [data-tour-overlay] com a chave de tutorial esperada, e nenhuma outra
     chave aparece numa rota que não é dona dela.
  3. Concluir um tour e pular outro, depois recarregar (reload) e navegar de
     novo via SPA: o tour NÃO pode reaparecer (regressão núcleo do onboarding).
  4. Viewport mobile (390x844): percorre todos os passos de um tour conferindo
     que o balão não sobrepõe o alvo destacado e fica inteiro dentro da tela.

Como rodar (dev server em http://localhost:8080):

    python3 tests/e2e/onboarding_tours.py
    python3 tests/e2e/onboarding_tours.py --rota admin
    python3 tests/e2e/onboarding_tours.py --rota vendedor,cliente

As contas demo usam senha fixa de teste (definida via ONBOARDING_E2E_SENHA ou
o padrão abaixo) — é preciso que a senha já esteja configurada nessas contas
(feito uma vez via API administrativa do Supabase, fora deste script; o
script em si só interage com a aplicação pela UI).
"""

import argparse
import asyncio
import json
import os
import sys
import uuid
from pathlib import Path

from playwright.async_api import async_playwright, expect, Page

BASE = "http://localhost:8080"
SENHA = os.environ.get("ONBOARDING_E2E_SENHA", "E2eTour!2024xk")

TRACE_ID = os.environ.get("E2E_TRACE_ID") or f"e2e-tours-{uuid.uuid4()}"
ARTIFACTS = Path(__file__).parent / "artifacts" / TRACE_ID

CONTAS = {
    "admin": "ti.renanlopes@gmail.com",
    "vendedor": "vendedor@demo.com",
    "cliente": "gabrielbrazschiaber3@gmail.com",
}

# Rotas críticas por papel: (rota, chave do tutorial, precisa reload p/ 1a visita)
ROTAS_POR_PAPEL = {
    "admin": [
        ("/admin", "tela:admin-dashboard"),
        ("/tarefas", "tela:tarefas"),
        ("/comercial", "tela:comercial"),
    ],
    "vendedor": [
        ("/vendedor", "tela:vendedor"),
        ("/tarefas", "tela:tarefas"),
        ("/comercial", "tela:comercial"),
    ],
    "cliente": [
        ("/cliente", "tela:cliente"),
        ("/solicitacoes", "tela:solicitacoes"),
    ],
}

FALHAS: list[str] = []


def registrar_falha(msg: str) -> None:
    FALHAS.append(msg)
    print("FALHA:", msg)


async def evidencias(page: Page, nome: str) -> None:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    try:
        await page.screenshot(path=str(ARTIFACTS / f"{nome}.png"))
    except Exception:
        pass
    try:
        (ARTIFACTS / f"{nome}.html").write_text(await page.content(), encoding="utf-8")
    except Exception:
        pass


async def login(page: Page, email: str) -> None:
    await page.goto(BASE + "/login", wait_until="domcontentloaded")
    await page.fill("#email", email)
    await page.fill("#password", SENHA)
    await page.click('button[type="submit"]')
    await page.wait_for_load_state("networkidle")
    await page.wait_for_timeout(400)


async def fechar_boas_vindas_se_houver(page: Page) -> None:
    """Dispensa o dialog de boas-vindas (1a vez do usuário) sem contar como
    conclusão de tour — clica em 'Agora não', que registra apenas o
    boas_vindas como pulado, sem afetar os tours de tela."""
    dialog = page.locator('[data-onboarding="boas-vindas"]')
    try:
        await dialog.wait_for(state="visible", timeout=3000)
    except Exception:
        return
    await page.click('[data-onboarding-acao="agora-nao"]')
    await dialog.wait_for(state="hidden", timeout=3000)


async def resetar_tela_via_ui(page: Page, chave: str, nome_evidencia: str) -> None:
    """Único caminho aceito para "zerar" um tutorial: pela UI (AjudaDaTela).
    Abre o botão de ajuda, clica em "Rever tutorial desta tela" (o que reabre
    o tour imediatamente em memória) e então recarrega a página SEM interagir
    com o tour, para que a próxima carga dispare o tour de forma natural
    (useTourDaTela), validando o comportamento real de 1a visita."""
    ajuda = page.locator('[data-tour="ajuda-tela"]')
    await ajuda.wait_for(state="visible", timeout=8000)
    await ajuda.click()
    botao = page.get_by_role("button", name="Rever tutorial desta tela")
    await botao.wait_for(state="visible", timeout=5000)
    await botao.click()
    # reiniciar() já reabre o tour em memória — não tocamos nele, só recarregamos.
    await page.wait_for_timeout(300)
    await evidencias(page, f"{nome_evidencia}_apos_reset")
    await page.reload(wait_until="domcontentloaded")


async def overlay_chave(page: Page) -> str | None:
    el = page.locator("[data-tour-overlay]").first
    try:
        if await el.count() == 0:
            return None
        return await el.get_attribute("data-tour-overlay")
    except Exception:
        return None


async def esperar_overlay(page: Page, timeout_ms: int = 4000) -> str | None:
    fim = asyncio.get_event_loop().time() + timeout_ms / 1000
    while asyncio.get_event_loop().time() < fim:
        chave = await overlay_chave(page)
        if chave:
            return chave
        await page.wait_for_timeout(150)
    return None


async def testar_primeira_visita(page: Page, papel: str, rota: str, chave_esperada: str) -> None:
    nome = f"{papel}_{rota.strip('/')}_primeira_visita"
    await page.goto(BASE + rota, wait_until="domcontentloaded")
    await fechar_boas_vindas_se_houver(page)
    await resetar_tela_via_ui(page, chave_esperada, nome)

    chave = await esperar_overlay(page)
    if chave is None:
        await evidencias(page, nome + "_ausente")
        registrar_falha(
            f"[{papel}] {rota}: tour '{chave_esperada}' não apareceu na 1a visita "
            f"após reset via UI — evidências em {ARTIFACTS / nome}"
        )
        return
    if chave != chave_esperada:
        await evidencias(page, nome + "_chave_errada")
        registrar_falha(
            f"[{papel}] {rota}: overlay mostrou chave '{chave}', esperado '{chave_esperada}' "
            f"— evidências em {ARTIFACTS / nome}"
        )
        return
    await evidencias(page, nome + "_ok")
    print(f"OK [{papel}] {rota}: tour '{chave}' apareceu na 1a visita")

    # Fecha para não atrapalhar o próximo cenário.
    if await page.locator('[data-tour-acao="pular"]').count() > 0:
        await page.click('[data-tour-acao="pular"]')
        await page.wait_for_timeout(200)


async def concluir_tour(page: Page) -> None:
    """Clica em 'Próximo' até o botão virar 'Concluir', e conclui."""
    for _ in range(30):
        overlay = page.locator("[data-tour-overlay]")
        if await overlay.count() == 0:
            return
        concluir_btn = page.locator('[data-tour-acao="concluir"]')
        if await concluir_btn.count() > 0:
            await concluir_btn.click()
            await page.wait_for_timeout(200)
            return
        prox = page.locator('[data-tour-acao="proximo"]')
        if await prox.count() > 0:
            await prox.click()
            await page.wait_for_timeout(150)
        else:
            return


async def testar_persistencia_apos_reload(page: Page, papel: str, rotas: list[tuple[str, str]]) -> None:
    """Núcleo da regressão: conclui um tour, pula outro, recarrega e navega de
    novo via SPA — nenhum dos dois pode reaparecer."""
    if len(rotas) < 2:
        return
    (rota_a, chave_a), (rota_b, chave_b) = rotas[0], rotas[1]

    # --- Concluir o tour da rota A ---
    await page.goto(BASE + rota_a, wait_until="domcontentloaded")
    await fechar_boas_vindas_se_houver(page)
    await resetar_tela_via_ui(page, chave_a, f"{papel}_persist_a")
    chave = await esperar_overlay(page)
    if chave != chave_a:
        registrar_falha(f"[{papel}] persistência: tour '{chave_a}' não apareceu para concluir")
        return
    await concluir_tour(page)

    # --- Pular o tour da rota B ---
    await page.goto(BASE + rota_b, wait_until="domcontentloaded")
    await fechar_boas_vindas_se_houver(page)
    await resetar_tela_via_ui(page, chave_b, f"{papel}_persist_b")
    chave = await esperar_overlay(page)
    if chave != chave_b:
        registrar_falha(f"[{papel}] persistência: tour '{chave_b}' não apareceu para pular")
        return
    await page.click('[data-tour-acao="pular"]')
    await page.wait_for_timeout(300)

    # --- Reload direto na rota A: tour concluído não pode voltar ---
    await page.goto(BASE + rota_a, wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)
    chave_reaparecida = await overlay_chave(page)
    if chave_reaparecida == chave_a:
        await evidencias(page, f"{papel}_regressao_concluido_reapareceu")
        registrar_falha(
            f"[{papel}] REGRESSÃO: tour '{chave_a}' (concluído) reapareceu em {rota_a} "
            f"após reload — evidências em {ARTIFACTS / (papel + '_regressao_concluido_reapareceu')}"
        )
    else:
        print(f"OK [{papel}] {rota_a}: tour concluído não reaparece após reload")

    # --- Navegação SPA para a rota B: tour pulado não pode voltar ---
    seletor = f'a[href="{rota_b}"], a[href^="{rota_b}?"]'
    link = page.locator(seletor).first
    if await link.count() > 0:
        await link.click()
        await page.wait_for_load_state("networkidle")
    else:
        await page.goto(BASE + rota_b, wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)
    chave_reaparecida = await overlay_chave(page)
    if chave_reaparecida == chave_b:
        await evidencias(page, f"{papel}_regressao_pulado_reapareceu")
        registrar_falha(
            f"[{papel}] REGRESSÃO: tour '{chave_b}' (pulado) reapareceu em {rota_b} "
            f"após navegação SPA — evidências em {ARTIFACTS / (papel + '_regressao_pulado_reapareceu')}"
        )
    else:
        print(f"OK [{papel}] {rota_b}: tour pulado não reaparece após navegação SPA")


def _sobrepoe(a: dict, b: dict) -> bool:
    return not (
        a["x"] + a["width"] <= b["x"]
        or b["x"] + b["width"] <= a["x"]
        or a["y"] + a["height"] <= b["y"]
        or b["y"] + b["height"] <= a["y"]
    )


async def testar_mobile(context, papel: str, rota: str, chave_esperada: str) -> None:
    page = await context.new_page()
    await page.set_viewport_size({"width": 390, "height": 844})
    await login(page, CONTAS[papel])
    await page.goto(BASE + rota, wait_until="domcontentloaded")
    await fechar_boas_vindas_se_houver(page)
    await resetar_tela_via_ui(page, chave_esperada, f"{papel}_mobile")

    chave = await esperar_overlay(page)
    if chave != chave_esperada:
        registrar_falha(f"[{papel}][mobile] tour '{chave_esperada}' não apareceu em {rota}")
        await page.close()
        return

    viewport = {"width": 390, "height": 844}
    passo_n = 0
    while True:
        passo_n += 1
        if await page.locator("[data-tour-overlay]").count() == 0:
            break
        balao = page.locator('[role="dialog"]').first
        await balao.wait_for(state="visible", timeout=3000)
        box_balao = await balao.bounding_box()
        if box_balao is None:
            registrar_falha(f"[{papel}][mobile] passo {passo_n}: balão sem bounding box em {rota}")
            break

        # (b) balão inteiro dentro do viewport
        dentro = (
            box_balao["x"] >= -0.5
            and box_balao["y"] >= -0.5
            and box_balao["x"] + box_balao["width"] <= viewport["width"] + 0.5
            and box_balao["y"] + box_balao["height"] <= viewport["height"] + 0.5
        )
        if not dentro:
            await evidencias(page, f"{papel}_mobile_passo{passo_n}_fora_viewport")
            registrar_falha(
                f"[{papel}][mobile] passo {passo_n} em {rota}: balão fora do viewport {box_balao} "
                f"— evidências em {ARTIFACTS / (papel + f'_mobile_passo{passo_n}_fora_viewport')}"
            )

        # texto visível (tamanho não-zero)
        titulo = page.locator("#tour-titulo")
        corpo = page.locator("#tour-corpo")
        box_titulo = await titulo.bounding_box()
        box_corpo = await corpo.bounding_box()
        for nome_txt, box_txt in (("titulo", box_titulo), ("corpo", box_corpo)):
            if box_txt is None or box_txt["width"] <= 0 or box_txt["height"] <= 0:
                registrar_falha(
                    f"[{papel}][mobile] passo {passo_n} em {rota}: texto '{nome_txt}' com tamanho zero/oculto"
                )

        # (a) balão não sobrepõe o alvo destacado
        alvo_destacado = page.locator(".ring-primary").first
        if await alvo_destacado.count() > 0:
            box_alvo = await alvo_destacado.bounding_box()
            if box_alvo and _sobrepoe(
                {"x": box_balao["x"], "y": box_balao["y"], "width": box_balao["width"], "height": box_balao["height"]},
                {"x": box_alvo["x"], "y": box_alvo["y"], "width": box_alvo["width"], "height": box_alvo["height"]},
            ):
                await evidencias(page, f"{papel}_mobile_passo{passo_n}_sobreposicao")
                registrar_falha(
                    f"[{papel}][mobile] passo {passo_n} em {rota}: balão {box_balao} sobrepõe alvo {box_alvo} "
                    f"— evidências em {ARTIFACTS / (papel + f'_mobile_passo{passo_n}_sobreposicao')}"
                )

        concluir_btn = page.locator('[data-tour-acao="concluir"]')
        if await concluir_btn.count() > 0:
            await concluir_btn.click()
            break
        prox = page.locator('[data-tour-acao="proximo"]')
        if await prox.count() > 0:
            await prox.click()
            await page.wait_for_timeout(250)
        else:
            break
        if passo_n > 25:
            break

    print(f"OK [{papel}][mobile] {rota}: {passo_n} passo(s) verificados sem sobreposição/estouro de viewport")
    await page.close()


async def rodar_papel(browser, papel: str) -> None:
    rotas = ROTAS_POR_PAPEL[papel]
    context = await browser.new_context(
        viewport={"width": 1366, "height": 900},
        record_video_dir=str(ARTIFACTS / "video" / papel),
    )
    page = await context.new_page()
    await login(page, CONTAS[papel])

    # 2) 1a visita de cada rota crítica
    for rota, chave in rotas:
        await testar_primeira_visita(page, papel, rota, chave)

    # 3) concluir + pular + reload/spa: tour não pode reaparecer
    await testar_persistencia_apos_reload(page, papel, rotas)

    await page.close()
    await context.close()

    # 4) mobile: percorre todos os passos do 1o tour do papel
    mobile_ctx = await browser.new_context(record_video_dir=str(ARTIFACTS / "video" / f"{papel}_mobile"))
    rota_mobile, chave_mobile = rotas[0]
    await testar_mobile(mobile_ctx, papel, rota_mobile, chave_mobile)
    await mobile_ctx.close()


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rota", "--papel", dest="papeis", default="",
                         help="Filtra papéis, separados por vírgula: admin,vendedor,cliente")
    args = parser.parse_args()

    papeis = [p.strip() for p in args.papeis.split(",") if p.strip()] or list(ROTAS_POR_PAPEL.keys())
    for p in papeis:
        if p not in ROTAS_POR_PAPEL:
            print(f"papel desconhecido: {p} (válidos: {list(ROTAS_POR_PAPEL.keys())})")
            return 2

    print(f"TRACE ID desta execução: {TRACE_ID}")
    print("papéis:", papeis)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        for papel in papeis:
            print(f"\n=== papel: {papel} ===")
            try:
                await rodar_papel(browser, papel)
            except Exception as e:
                registrar_falha(f"[{papel}] exceção não tratada: {type(e).__name__}: {e}")
        await browser.close()

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    (ARTIFACTS / "resumo.json").write_text(
        json.dumps({"trace_id": TRACE_ID, "papeis": papeis, "falhas": FALHAS}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    if FALHAS:
        print("\nFALHOU:")
        for f in FALHAS:
            print(" -", f)
        print(f"\nTrace {TRACE_ID} — evidências em {ARTIFACTS}")
        return 1
    print(f"\nOK: todos os tours de onboarding se comportaram como esperado (trace {TRACE_ID}).")
    return 0


sys.exit(asyncio.run(main()))
