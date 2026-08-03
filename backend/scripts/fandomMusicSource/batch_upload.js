#!/usr/bin/env node
// Reliable batch FLAC uploader — Node.js, no shell quoting issues
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const API_HOST = '127.0.0.1';
const API_PORT = 3002;
const FLAC_DIR = '/tmp/batch_upload/补充';
const CREDS = { identifier: 'admin', password: 'kWMD3SWMRBS7cuSx' };

let TOKEN = '';
let success = 0, failed = 0, skipped = 0;

function apiPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: API_HOST, port: API_PORT, path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {}),
      }
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch(e) { reject(new Error(buf.slice(0,200))); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function uploadFile(flacPath, title, album, gameId, trackNum) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + crypto.randomBytes(16).toString('hex');
    const fileData = fs.readFileSync(flacPath);
    const filename = path.basename(flacPath);
    
    const parts = [];
    const addField = (name, value) => {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    };
    const addFile = (name, fname, data) => {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${fname}"\r\nContent-Type: audio/flac\r\n\r\n`));
      parts.push(data);
      parts.push(Buffer.from('\r\n'));
    };
    
    addField('title_override', title);
    addField('album_override', album);
    addField('game_id', String(gameId));
    addField('track_number_override', String(trackNum));
    addFile('tracks', filename, fileData);
    parts.push(Buffer.from(`--${boundary}--\r\n`));
    
    const body = Buffer.concat(parts);
    const req = http.request({
      hostname: API_HOST, port: API_PORT,
      path: '/api/tracks/upload?auto_credits=false',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      }
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch(e) { reject(new Error(buf.slice(0,200))); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getTags(flacPath) {
  try {
    const out = execFileSync('metaflac', ['--export-tags-to=-', flacPath], { encoding: 'utf8', timeout: 5000 });
    const tags = {};
    for (const line of out.split('\n')) {
      const idx = line.indexOf('=');
      if (idx > 0) tags[line.slice(0, idx).toUpperCase()] = line.slice(idx + 1).trim();
    }
    return tags;
  } catch { return {}; }
}

async function main() {
  // Login
  const login = await apiPost('/api/auth/login', CREDS);
  if (!login.success) { console.error('Login failed:', JSON.stringify(login)); process.exit(1); }
  TOKEN = login.data.token;
  console.log('✅ Logged in');

  const flacFiles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.flac')) flacFiles.push(full);
    }
  }
  walk(FLAC_DIR);
  flacFiles.sort();
  
  // Get current max track ID to detect already-uploaded
  const total = flacFiles.length;
  console.log(`Total: ${total} FLAC files`);
  
  // Skip already uploaded: 112 tracks (files 1-112 → IDs 3612-3722)
  const SKIP = 112;
  
  for (let i = 0; i < total; i++) {
    const flac = flacFiles[i];
    const num = i + 1;
    
    if (num <= SKIP) {
      console.log(`[${num}/SKIP] ${path.basename(path.dirname(flac))}/${path.basename(flac)}`);
      skipped++;
      continue;
    }
    
    const albumDir = path.basename(path.dirname(flac));
    let gameId = 3;
    if (albumDir.startsWith('崩坏星穹铁道')) gameId = 2;
    else if (albumDir.startsWith('珍珠之歌')) gameId = 1;
    
    const tags = getTags(flac);
    const title = tags.TITLE || path.basename(flac, '.flac');
    const trackNum = tags.TRACKNUMBER || '1';
    const album = tags.ALBUM || albumDir;
    
    try {
      const result = await uploadFile(flac, title, album, gameId, trackNum);
      if (result.success) {
        const tid = result.data?.tracks?.[0]?.id || '?';
        console.log(`[${num}/${total}] ✅ #${tid} ${title} | ${album}`);
        success++;
      } else {
        console.log(`[${num}/${total}] ❌ ${title}: ${result.error?.message || 'unknown'}`);
        failed++;
      }
    } catch(e) {
      console.log(`[${num}/${total}] ❌ ${title}: ${e.message}`);
      failed++;
    }
  }
  
  console.log(`\n=== DONE ===`);
  console.log(`Success: ${success}, Failed: ${failed}, Skipped: ${skipped}, Total: ${total}`);
}

main().catch(e => { console.error(e); process.exit(1); });
