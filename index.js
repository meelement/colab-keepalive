const STORAGE_ACCOUNT = {
	username: 'account@gmail.com',
	password: 'password'
};
const NOTEBOOKS = [
	{
		url: 'https://colab.research.google.com/drive/UUID',
		name: 'Instance Name',
		accounts: [
			{
				username: 'account01@gmail.com',
				password: 'password'
			},
			{
				username: 'account02@gmail.com',
				password: 'password'
			}
		]
	}
];

const puppeteer = require('puppeteer');

(async (notebook) => {
	console.log('Logging in to storage account');
	const storage_browser = await puppeteer.launch({
		headless: false,
		// Next line saves some memory. I hope Colab doesn't try to hack us.
		args: ['--no-sandbox', '--disable-setuid-sandbox']
	});
	const storage_page = await storage_browser.newPage();

	await storage_page.setUserAgent('bruh');

	await storage_page.goto('https://accounts.google.com/');
	await storage_page.waitForSelector('input[type="email"]');
	await storage_page.type('input[type="email"]', STORAGE_ACCOUNT.username);
	await storage_page.waitForSelector('#next');
	await storage_page.click('#next');
	await storage_page.waitForSelector('input[type="password"]');
	await storage_page.type('input[type="password"]', STORAGE_ACCOUNT.password);
	await storage_page.waitForSelector('#submit');
	await storage_page.click('#submit');
	await storage_page.waitForNavigation();
	await storage_page.close();

	for (const notebook of NOTEBOOKS) {
		(async (notebook) => {
			let account = 0;
			console.info(`Connecting to ${notebook.name}`);
			while (true) {
				// Use a new browser instance every time because I am lazy and I'm fine with wasting some RAM here
				// Would take more work to put everything in tabs
				const browser = await puppeteer.launch({
					headless: false,
					// Next line saves some memory. I hope Colab doesn't try to hack us.
					args: ['--no-sandbox', '--disable-setuid-sandbox']
				});
				const page = await browser.newPage();
		
				// DEBUG
				await page.setUserAgent('bruh');
				// let counter = 0;
				// setInterval(() => {
				// 	page.screenshot({path: `screenshots/screenshot-${counter}.png`});
				// 	counter++;
				// }, 10000);

				// Login
				await page.goto('https://accounts.google.com/');
				await page.waitForSelector('input[type="email"]');
				await page.type('input[type="email"]', notebook.accounts[account].username);
				await page.waitForSelector('#next');
				await page.click('#next');
				await page.waitForSelector('input[type="password"]');
				await page.type('input[type="password"]', notebook.accounts[account].password);
				await page.waitForSelector('#submit');
				await page.click('#submit');
				await page.waitFor(2000);
				// await page.waitForNavigation();
		
				// Start notebook
				console.log(notebook);
				console.log(notebook.url);
				await page.goto(notebook.url);
				await page.waitForSelector('.cell-execution-container');
				await page.waitFor(2000);
				await page.keyboard.down('Control');
				await page.keyboard.press('F9');
				await page.keyboard.up('Control');
				await page.waitFor(2000);
				await page.click('#ok');

				// Wait for Google Drive login
				await page.waitForSelector('a[rel="nofollow"]', {
					timeout: 240000
				});
				const approval_url = await page.evaluate(() => document.querySelectorAll('a[rel="nofollow"]')[0].getAttribute('href'));
				const approval_page = await storage_browser.newPage();
				approval_page.goto(approval_url);
				await approval_page.waitForSelector(`div[data-identifier="${STORAGE_ACCOUNT.username.toLowerCase()}"]`);
				await approval_page.click(`div[data-identifier="${STORAGE_ACCOUNT.username.toLowerCase()}"]`);
				await approval_page.waitForNavigation();
				await approval_page.waitForSelector('#submit_approve_access');
				await approval_page.click('#submit_approve_access');
				await approval_page.waitForNavigation();
				await approval_page.waitForSelector('textarea');
				const approval_code = await approval_page.evaluate(() => document.querySelectorAll('textarea')[0].value);
				approval_page.close();
				await page.type('.raw_input', approval_code);
				await page.keyboard.press('Enter');

				// Keep alive
				page.evaluate(() => setInterval(() => document.querySelector('colab-connect-button').shadowRoot.getElementById('connect').click(), 600000));

				// Check for timeout every 20 seconds
				await page.waitForFunction('document.querySelector("colab-connect-button").shadowRoot.getElementById("connect").innerText == "Reconnect"', {
					timeout: 0,
					polling: 'mutation'
				});
				browser.close();
				console.info(`Reconnecting to ${notebook.name}`);
				account = account == 0 ? 1 : 0;
			}
		})(notebook);
	}
})();