/**
 * Test script for GPT-4 Vision auto-tagging
 * 
 * To run:
 * 1. Set OPENAI_API_KEY environment variable: export OPENAI_API_KEY="your-key"
 * 2. Run: npx tsx test-vision.ts
 * 
 * Or test with a different image URL by modifying SAMPLE_IMAGE_URL below
 */

// Sample image URL - using a public jewelry image for testing
// You can replace this with any publicly accessible image URL
const SAMPLE_IMAGE_URL = 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800';

// Replace with your actual edge function URL
const EDGE_BASE_URL = process.env.EXPO_PUBLIC_EDGE_BASE_URL || 'http://localhost:54321/functions/v1';

async function testVisionAPI() {
  console.log('🧪 Testing GPT-4 Vision API...\n');
  console.log('Sample Image URL:', SAMPLE_IMAGE_URL);
  console.log('Edge Function URL:', `${EDGE_BASE_URL}/auto_tag_asset`);
  console.log('\n');

  try {
    // Test the OpenAI API directly first
    const openAiKey = process.env.OPENAI_API_KEY;
    if (!openAiKey) {
      console.error('❌ OPENAI_API_KEY not found in environment variables');
      console.log('Please set OPENAI_API_KEY to test the vision API');
      return;
    }

    console.log('✅ OpenAI API Key found\n');

    const TAG_VOCABULARY = [
      'Product',
      'Queens',
      'Tali',
      'Quotes',
      'Testimonials',
      'Necklace',
      'Earrings',
      'Rings',
      'Bracelets',
    ];

    const payload = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are tagging photos for a high-end jewelry brand. Only choose tags from the provided vocabulary. Return JSON: {"tags": ["Tag1","Tag2"]}.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Vocabulary: ${TAG_VOCABULARY.join(', ')}. Select one to five tags that best describe the image.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: SAMPLE_IMAGE_URL,
              },
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'tag_response',
          schema: {
            type: 'object',
            properties: {
              tags: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: TAG_VOCABULARY,
                },
                minItems: 1,
                maxItems: 5,
              },
            },
            required: ['tags'],
            additionalProperties: false,
          },
          strict: true,
        },
      },
      max_tokens: 200,
    };

    console.log('📤 Sending request to OpenAI...\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API Error:', response.status, response.statusText);
      console.error('Error details:', errorText);
      return;
    }

    const json = await response.json();
    console.log('📥 Response received:\n');
    console.log(JSON.stringify(json, null, 2));
    console.log('\n');

    const content = json.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content);
    const tags = Array.isArray(parsed.tags) ? parsed.tags : [];

    console.log('✅ Tags extracted:', tags);
    console.log('\n🎉 Vision API test successful!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

// Run the test
testVisionAPI();

