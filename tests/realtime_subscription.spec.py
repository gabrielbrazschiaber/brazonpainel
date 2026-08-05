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
        
        # Give it a moment to stabilize subscriptions
        await asyncio.sleep(2)
        
        # Check if the "Realtime Ativo" badge is visible
        badge = page.locator('text="Realtime Ativo"')
        is_visible = await badge.is_visible()
        print(f"Realtime Ativo badge visible: {is_visible}")
        
        # Log all errors found
        if errors:
            print("Errors detected during page load:")
            for err in errors:
                print(f"  - {err}")
        else:
            print("No console errors detected.")

        # Specific check for the forbidden pattern in console
        forbidden_error = "cannot add `postgres_changes` callbacks for realtime:banco-leads-admin-panorama after `subscribe()`"
        has_forbidden_error = any(forbidden_error in err for err in errors)
        
        if has_forbidden_error:
            print("CRITICAL: The subscription order bug was detected!")
            exit(1)
        else:
            print("SUCCESS: The subscription order bug was NOT detected.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_realtime_lifecycle())
