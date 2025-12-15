/**
 * Script to find storage path for a user by email
 * Run with: npx tsx scripts/find-user-storage-path.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findUserStoragePath(email: string) {
  try {
    console.log(`\n🔍 Looking up user: ${email}\n`);

    // Query auth.users table to get user ID
    const { data: users, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching users:', authError);
      return;
    }

    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return;
    }

    const userId = user.id;
    console.log(`✅ Found user:`);
    console.log(`   Email: ${email}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Created: ${user.created_at}`);

    // Get campaigns for this user
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (campaignError) {
      console.error('Error fetching campaigns:', campaignError);
    } else {
      console.log(`\n📁 Campaigns (${campaigns?.length || 0}):`);
      if (campaigns && campaigns.length > 0) {
        campaigns.forEach((campaign, idx) => {
          console.log(`   ${idx + 1}. ${campaign.name} (${campaign.id})`);
          console.log(`      A1 Path: users/${userId}/campaigns/${campaign.id}/`);
          console.log(`      A2 Path: users/${userId}/campaigns/${campaign.id}/ai/`);
        });
      } else {
        console.log('   No campaigns found');
      }
    }

    // Show storage paths
    console.log(`\n📦 Storage Paths:`);
    console.log(`   Bucket: assets`);
    console.log(`   Base Path: users/${userId}/`);
    console.log(`   A1 Images: users/${userId}/campaigns/{campaignId}/{filename}`);
    console.log(`   A2 Images: users/${userId}/campaigns/{campaignId}/ai/{filename}`);

    // Try to list files in storage
    console.log(`\n🔍 Checking storage for A2 images...`);
    const { data: files, error: storageError } = await supabase
      .storage
      .from('assets')
      .list(`users/${userId}`, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (storageError) {
      console.error('Error listing storage:', storageError);
    } else if (files && files.length > 0) {
      console.log(`   Found ${files.length} items in users/${userId}/`);
      
      // Look for campaigns directory
      const campaignsDir = files.find(f => f.name === 'campaigns');
      if (campaignsDir) {
        console.log(`   ✅ Found campaigns directory`);
        
        // List campaigns
        const { data: campaignDirs } = await supabase
          .storage
          .from('assets')
          .list(`users/${userId}/campaigns`, {
            limit: 100
          });
        
        if (campaignDirs && campaignDirs.length > 0) {
          console.log(`   Found ${campaignDirs.length} campaign directories:`);
          for (const campaignDir of campaignDirs) {
            // Check for ai subdirectory
            const { data: aiFiles } = await supabase
              .storage
              .from('assets')
              .list(`users/${userId}/campaigns/${campaignDir.name}/ai`, {
                limit: 10
              });
            
            const aiCount = aiFiles?.length || 0;
            console.log(`      - ${campaignDir.name}/`);
            console.log(`        A2 images: ${aiCount > 0 ? `✅ ${aiCount} files` : '❌ None found'}`);
          }
        }
      } else {
        console.log(`   ⚠️  No campaigns directory found`);
      }
    } else {
      console.log(`   ⚠️  No files found in users/${userId}/`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
const email = process.argv[2] || 'kpolevoy@gmail.com';
findUserStoragePath(email).then(() => {
  console.log('\n✅ Done\n');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});








