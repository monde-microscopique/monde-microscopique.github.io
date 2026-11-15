// Outils communs aux contrôles dans le navigateur : petit serveur statique et lancement de Chrome.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };

export function servir(dossier = join(RACINE, 'dist')) {
  return new Promise((resolve) => {
    const serveur = createServer(async (req, res) => {
      const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const fichier = join(dossier, chemin.endsWith('/') ? chemin + 'index.html' : chemin);
      try {
        const data = await readFile(fichier);
        res.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404); res.end('absent');
      }
    });
    serveur.listen(0, '127.0.0.1', () => resolve({ serveur, url: `http://127.0.0.1:${serveur.address().port}/` }));
  });
}

export function cheminChrome() {
  const candidats = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return candidats.find((c) => c && existsSync(c));
}

export async function lancer() {
  return chromium.launch({
    executablePath: cheminChrome(),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
}
