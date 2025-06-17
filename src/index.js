export default {
    async fetch(request, env, ctx) {
        // --- 1. Handle CORS Preflight Requests (OPTIONS method) ---
        // Browsers send an OPTIONS request before the actual POST request
        // to check if the cross-origin request is allowed.
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
        // Only accept POST requests for processing AI queries.
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        // --- 3. Parse Request Body ---
        // Attempt to parse the incoming request body as JSON.
        let requestData;
        try {
            requestData = await request.json();
        } catch (e) {
            // Return a 400 Bad Request if the JSON is malformed.
            return new Response(JSON.stringify({ message: 'Invalid JSON in request body' }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' // Crucial for CORS on error responses too
                },
            });
        }
        
        const { image, prompt } = requestData;

        // --- 4. Basic Input Validation ---
        // Ensure both image and prompt are present in the request.
        if (!image || !prompt) {
            return new Response(JSON.stringify({ message: 'Missing image (base64 data URI) or prompt in request body' }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
            });
        }

        // Ensure the image data is in the expected Data URI format.
        if (!image.startsWith('data:image/') || !image.includes(';base64,')) {
            return new Response(JSON.stringify({ message: 'Invalid image format. Must be a base64 Data URI (e.g., data:image/jpeg;base64,...)' }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
            });
        }

        // --- 5. Call Cloudflare Workers AI API ---
        // Construct the URL for the LLaVA 1.5-7B-HF model.
        // The `env` object provides access to environment variables (including secrets).
        // If deploying via GitHub/Cloudflare Pages, ensure these are set in your Pages project
        // environment variables or GitHub Actions secrets and passed to Wrangler.
        const CLOUDFLARE_AI_URL = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/ai/run/@cf/llava-1.5-7b-hf`;

        // Prepare the payload according to the Cloudflare Workers AI API documentation.
        const aiPayload = {
            messages: [
                {
                    role: "user",
                    content: prompt,
                    image: image // The base64-encoded image with its data URI prefix
                }
            ]
        };

        try {
            // Make the actual fetch request to the Cloudflare AI API.
            // Authentication is handled via the `Authorization` header using the securely stored API_TOKEN.
            const aiResponse = await fetch(CLOUDFLARE_AI_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${env.API_TOKEN}`, // THIS IS WHERE AUTHENTICATION HAPPENS!
                                                                  // Ensure env.API_TOKEN is available to your Worker
                                                                  // via Pages Env Vars or GitHub Secrets.
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(aiPayload),
            });

            // --- 6. Handle AI API Response ---
            // If the AI API returns an error (e.g., 401, 400, 500), propagate it back.
            if (!aiResponse.ok) {
                const errorData = await aiResponse.json();
                console.error("AI API Error:", errorData); // Log detailed error for debugging in `wrangler tail` or Pages logs
                return new Response(JSON.stringify({ 
                    message: `AI model error: ${errorData.errors?.[0]?.message || 'Unknown error from Cloudflare AI'}` 
                }), {
                    status: aiResponse.status, // Pass through the AI API's original status code
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*' // Maintain CORS headers for error responses
                    },
                });
            }

            // If AI API call was successful, parse its JSON result.
            const aiResult = await aiResponse.json();
            
            // --- 7. Return AI Result to Frontend ---
            // Send the AI's response back to your frontend.
            return new Response(JSON.stringify(aiResult), {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' // Allow your frontend to read this successful response
                },
            });

        } catch (error) {
            // --- 8. Handle Unexpected Worker Errors ---
            // Catch any network issues or other unexpected errors that occur during the Worker's execution.
            console.error("Worker error during AI API call:", error);
            return new Response(JSON.stringify({ message: 'Internal server error while processing request', error: error.message }), {
                status: 500,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
            });
        }
    },
};
