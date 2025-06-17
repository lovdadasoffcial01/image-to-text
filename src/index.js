// src/index.js - Your Cloudflare Worker script

// This Worker acts as a secure proxy to the Cloudflare Workers AI API using the env.AI binding.
// The env.AI binding automatically handles authentication and URL construction,
// keeping your ACCOUNT_ID and API_TOKEN secure.

// No 'interface Env' declaration here, as this is a plain JavaScript file.
// The `env` object will still be provided by Cloudflare's runtime.

export default {
    // The 'env' parameter will contain your AI binding and any other variables.
    // Using 'any' type here for 'env' to avoid TypeScript errors in a .js file.
    async fetch(request, env) {
        // --- 1. Handle CORS Preflight Requests (OPTIONS method) ---
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*', // Allows requests from any origin (your frontend)
                    'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allowed HTTP methods
                    'Access-Control-Allow-Headers': 'Content-Type', // Allowed headers in the actual request
                    'Access-Control-Max-Age': '86400', // How long the preflight results can be cached (24 hours)
                },
            });
        }

        // --- 2. Enforce POST Method for AI Queries ---
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        // --- 3. Parse Request Body ---
        let requestData;
        try {
            requestData = await request.json();
        } catch (e) {
            return new Response(JSON.stringify({ message: 'Invalid JSON in request body' }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
            });
        }
        
        const { image, prompt } = requestData; // 'image' here is the base64 Data URI string from frontend

        // --- 4. Basic Input Validation ---
        if (!image || !prompt) {
            return new Response(JSON.stringify({ message: 'Missing image (base64 data URI) or prompt in request body' }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
            });
        }

        // Ensure the image data is a valid Data URI prefix
        if (!image.startsWith('data:image/') || !image.includes(';base64,')) {
            return new Response(JSON.stringify({ message: 'Invalid image format. Must be a base64 Data URI (e.g., data:image/jpeg;base64,...)' }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
            });
        }

        // --- IMPORTANT: Convert Base64 Data URI to Uint8Array for env.AI.run() ---
        // The env.AI.run() binding expects raw binary image data (Uint8Array),
        // not a base64 string.
        const base64Data = image.split(',')[1]; // Extract just the base64 part
        let imageUint8Array;
        try {
            const binaryString = atob(base64Data); // Decode base64 to binary string
            imageUint8Array = Uint8Array.from(binaryString, (char) => char.charCodeAt(0)); // Convert to Uint8Array
        } catch (e) {
            console.error("Base64 decoding error:", e);
            return new Response(JSON.stringify({ message: 'Failed to decode base64 image data.' }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
            });
        }

        // --- 5. Call Cloudflare Workers AI using the `env.AI` binding ---
        const modelId = "@cf/llava-hf/llava-1.5-7b-hf"; // This is the exact model ID from Cloudflare's docs
        const aiInput = {
            messages: [
                {
                    role: "user",
                    content: prompt,
                    image: [...imageUint8Array] // Pass the Uint8Array contents as an array of numbers
                }
            ],
            max_tokens: 512, // A common default for generating descriptions
        };

        try {
            // Make the call to the Cloudflare AI binding.
            // Cloudflare handles authentication and API URL automatically here.
            const aiResult = await env.AI.run(modelId, aiInput);
            
            // --- 6. Return AI Result to Frontend ---
            // The `aiResult` object from LLaVA usually contains a 'description' field.
            return new Response(JSON.stringify(aiResult), {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
            });

        } catch (error) {
            // --- 7. Handle Errors from AI Binding ---
            console.error("Worker error during AI binding call:", error);
            // Provide a user-friendly error message.
            const errorMessage = typeof error === 'string' ? error : (error.message || 'Unknown error from Cloudflare AI binding');
            return new Response(JSON.stringify({ message: `AI model error: ${errorMessage}` }), {
                status: 500, // Internal Server Error due to Worker's issue with AI call
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
            });
        }
    },
};
