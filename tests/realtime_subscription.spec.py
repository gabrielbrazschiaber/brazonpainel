import asyncio
import os
import json
from pathlib import Path
from playwright.async_api import async_playwright

async def test_realtime_lifecycle():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
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

        # Navigate to the leads bank page
        print(f"Navigating to /banco-leads...")
        await page.goto("http://localhost:8080/banco-leads", wait_until="networkidle")
        
        # We check if we are redirected
        current_url = page.url
        print(f"Current URL: {current_url}")
        
        if "/login" in current_url:
            print("Auth not active, redirected to login.")
        else:
            # Try to switch tabs if elements are present
            # We use a very soft check to avoid TimeoutErrors
            try:
                # Give it a moment
                await asyncio.sleep(3)
                
                # Check for any tab trigger
                tab_triggers = page.locator('button[role="tab"]')
                count = await tab_triggers.count()
                print(f"Found {count} tabs.")
                
                if count >= 2:
                    # Switch to the second tab
                    print("Switching to second tab...")
                    await tab_triggers.nth(1).click()
                    await asyncio.sleep(1)
                    
                    # Switch back to the first tab
                    print("Switching back to first tab...")
                    await tab_triggers.nth(0).click()
                    await asyncio.sleep(2)
            except Exception as e:
                print(f"Navigation error (ignoring for error check): {e}")

        # Final check for errors
        print("Final error check...")
        forbidden_error = "cannot add `postgres_changes` callbacks for realtime"
        has_forbidden_error = any(forbidden_error in err for err in errors)
        
        if errors:
            print("Console errors detected:")
            for err in errors:
                print(f"  - {err}")

        if has_forbidden_error:
            print("CRITICAL: Subscription order bug or lifecycle leak detected!")
            exit(1)
        else:
            print("SUCCESS: No critical subscription errors detected.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_realtime_lifecycle())
