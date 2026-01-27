#!/usr/bin/env tsx
/**
 * Migration script to convert existing public URLs to file paths
 * 
 * This script updates:
 * 1. answers.fileUrl - from public URL to storage path
 * 2. fileUploads.fileUrl - from public URL to storage path
 * 
 * Run with: tsx scripts/backfill-file-paths.ts
 */

import { db } from '../src/db/index.js';
import { answers, fileUploads } from '../src/db/schema.js';
import { sql } from 'drizzle-orm';

async function extractPathFromPublicUrl(publicUrl: string | null): Promise<string | null> {
  if (!publicUrl) return null;

  // Expected format: https://<project>.supabase.co/storage/v1/object/public/submissions/<path>
  // We want to extract: <path>
  
  const match = publicUrl.match(/\/storage\/v1\/object\/public\/submissions\/(.+)$/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }

  // If already a path (no URL scheme), return as-is
  if (!publicUrl.startsWith('http')) {
    return publicUrl;
  }

  console.warn(`Could not extract path from URL: ${publicUrl}`);
  return null;
}

async function backfillAnswers() {
  console.log('Backfilling answers.fileUrl...');
  
  const allAnswers = await db.select().from(answers);
  let updated = 0;
  let skipped = 0;
  
  for (const answer of allAnswers) {
    if (!answer.fileUrl) {
      skipped++;
      continue;
    }

    const path = await extractPathFromPublicUrl(answer.fileUrl);
    
    if (path && path !== answer.fileUrl) {
      await db
        .update(answers)
        .set({ fileUrl: path })
        .where(sql`${answers.id} = ${answer.id}`);
      
      updated++;
      console.log(`Updated answer ${answer.id}: ${answer.fileUrl} -> ${path}`);
    } else {
      skipped++;
    }
  }
  
  console.log(`Answers: ${updated} updated, ${skipped} skipped`);
}

async function backfillFileUploads() {
  console.log('\nBackfilling fileUploads.fileUrl...');
  
  const allUploads = await db.select().from(fileUploads);
  let updated = 0;
  let skipped = 0;
  
  for (const upload of allUploads) {
    const path = await extractPathFromPublicUrl(upload.fileUrl);
    
    if (path && path !== upload.fileUrl) {
      await db
        .update(fileUploads)
        .set({ fileUrl: path })
        .where(sql`${fileUploads.id} = ${upload.id}`);
      
      updated++;
      console.log(`Updated upload ${upload.id}: ${upload.fileUrl} -> ${path}`);
    } else {
      skipped++;
    }
  }
  
  console.log(`File uploads: ${updated} updated, ${skipped} skipped`);
}

async function main() {
  console.log('Starting backfill of file paths...\n');
  
  try {
    await backfillAnswers();
    await backfillFileUploads();
    
    console.log('\n✅ Backfill completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  }
}

main();
