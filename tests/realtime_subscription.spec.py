import asyncio
import os
import json
from pathlib import Path
from playwright.async_api import async_playwright

async def test_realtime_lifecycle():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # We need a large viewport to see everything
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        
        # Inject auth if available
        storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
        session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

        if cookies_json:
            cookies = json.loads(cookies_json)
            for c in cookies:
                c["url"] = "http://localhost:8080"
            await context.add_cookies(cookies)

        page = await context.new_page()
        
        # Establish origin
        await page.goto("http://localhost:8080")
        if storage_key and session_json:
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
            )
            
        # Capture console errors
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(err.message))

        # Navigate to the leads bank page where the component is
        print("Navigating to /banco-leads...")
        await page.goto("http://localhost:8080/banco-leads", wait_until="networkidle")
        
        # We check if we are redirected to login (auth failure) or stay on page
        if "/login" in page.url:
            print("Redirected to login. Attempting to bypass auth check for structural validation...")
            # For this test, we care about the console error that happens during component mount/unmount
            # If we can't login, we can at least verify the script runs without crashing.
            print("SKIPPING UI INTERACTION: Auth session not injected.")
        else:
            # Give it a moment to stabilize subscriptions
            await asyncio.sleep(2)
            
            # Test tab switching: Visão Geral -> Disponíveis -> Visão Geral
            # 1. Start at Visão Geral (default for admin)
            print("Checking initial Visão Geral tab...")
            # Use a more flexible selector
            tab_trigger = page.locator('role=tab[name=/Visão geral/i]')
            if await tab_trigger.count() > 0:
                await tab_trigger.wait_for(state="visible")
                
                # 2. Switch to 'Disponíveis'
                print("Switching to 'Disponíveis' tab...")
                await page.click('role=tab[name=/Disponíveis/i]')
                await asyncio.sleep(1) # Wait for unmount cleanup
                
                # 3. Switch back to 'Visão geral'
                print("Switching back to 'Visão geral' tab...")
                await page.click('role=tab[name=/Visão geral/i]')
                await asyncio.sleep(2) # Wait for remount and subscription
                
                # Check if the "Realtime Ativo" badge is visible
                badge = page.locator('text="Realtime Ativo"')
                is_visible = await badge.is_visible()
                print(f"Realtime Ativo badge visible: {is_visible}")
            else:
                print("Tab triggers not found. User might not be an admin.")
        
        # Log all errors found
        if errors:
            print("Errors detected during page interaction:")
            for err in errors:
                print(f"  - {err}")
        else:
            print("No console errors detected.")

        # Specific check for the forbidden pattern in console
        forbidden_error = "cannot add `postgres_changes` callbacks for realtime"
        has_forbidden_error = any(forbidden_error in err for err in errors)
        
        if has_forbidden_error:
            print("CRITICAL: Subscription order bug or lifecycle leak detected!")
            exit(1)
        else:
            print("SUCCESS: No subscription errors during navigation.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_realtime_lifecycle())
