# Daily RPG (Canvas)

Minimal, dependency-free RPG canvas with pluggable data, dice, and logging.

## Files
- `index.html` — references external JS via jsDelivr (replace `YOUR_USER/YOUR_REPO`)
- `daily-rpg/game.js` — main game
- `daily-rpg/dice.js` — custom dice algorithm
- `daily-rpg/content.js` — optional CSV/Sheet loader to override scenarios
- `daily-rpg/logger.js` — optional Google Apps Script logger
- `data/scenarios.csv` — example data file

## CDN URLs
```
https://cdn.jsdelivr.net/gh/<USER>/<REPO>@<BRANCH_OR_TAG>/daily-rpg/game.js
https://cdn.jsdelivr.net/gh/<USER>/<REPO>@<BRANCH_OR_TAG>/daily-rpg/dice.js
https://cdn.jsdelivr.net/gh/<USER>/<REPO>@<BRANCH_OR_TAG>/daily-rpg/content.js
https://cdn.jsdelivr.net/gh/<USER>/<REPO>@<BRANCH_OR_TAG>/daily-rpg/logger.js
https://cdn.jsdelivr.net/gh/<USER>/<REPO>@<BRANCH_OR_TAG>/data/scenarios.csv
```

## Google Apps Script (optional)
Create a Sheet, then an Apps Script (Web App) with this `doPost` handler to log selections:

```js
function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('log') || ss.insertSheet('log');
  const data = JSON.parse(e.postData.contents || '{}');
  sheet.appendRow([
    new Date(),
    data.scenarioTitle || '',
    data.choiceIndex,
    data.raw,
    data.bonus,
    data.total,
    data.tag
  ]);
  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}
```
Deploy: **Deploy > New deployment > Web app**, Execute as **Me**, Who has access **Anyone**.
Set `window.LOG_POST_URL` in `logger.js` to the web app URL.
