// Global functions Apps Script calls. All logic lives in bundle.js (App).
function doGet(e) { return App.doGet(e); }
function doPost(e) { return App.doPost(e); }
function createSheets() { App.createSheets(); }
function setup() { App.setup(); }
function generateToken() { App.generateToken(); }
function useRealSheet() { App.useRealSheet(); }
function runMigration() { App.runMigration(); }
