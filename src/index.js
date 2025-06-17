export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight requests
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*', // Allow all origins for simplicity in this example
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
                },
            });
        }

        // Only allow POST requests for the AI query
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        let requestData;
        try {
            requestData = await request.json();
        } catch (e) {
            return new Response(JSON.stringify({ message: 'Invalid JSON in request body' }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' // Also send CORS headers for error responses
                },
            });
        }
        
        const { image, prompt } = requestData;

        // Basic validation of incoming data
        if (!image || !prompt) {
            return new Response(JSON.stringify({ message: 'Missing image (base64 data URI) or prompt in request body' }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
            });
        }

        // Ensure the image data is a valid Data URI
        if (!image.startsWith('data:image/') || !image.includes(';base64,')) {
            return new Response(JSON.stringify({ message: 'Invalid image format. Must be a base64 Data URI (e.g., data:image/jpeg;base64,...)' }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
            });
        }

        // --- Cloudflare Workers AI API Call ---
        // Construct the URL for the LLaVA 1.5-7B-HF model
        // env.ACCOUNT_ID and env.API_TOKEN are accessed from Worker Environment Variables (Secrets)
        const CLOUDFLARE_AI_URL = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/ai/run/@cf/llava-1.5-7b-hf`;

        // Prepare the payload for the Cloudflare AI API
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
            // Make the request to the Cloudflare AI API
            const aiResponse = await fetch(CLOUDFLARE_AI_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${env.API_TOKEN}`, // Securely use the API Token from environment
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(aiPayload),
            });

            // Check for errors from the Cloudflare AI API itself
            if (!aiResponse.ok) {
                const errorData = await aiResponse.json();
                console.error("AI API Error:", errorData); // Log detailed error for debugging
                return new Response(JSON.stringify({ 
                    message: `AI model error: ${errorData.errors?.[0]?.message || 'Unknown error from Cloudflare AI'}` 
                }), {
                    status: aiResponse.status, // Pass through the AI API's status code
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                });
            }

            // Get the JSON result from the AI API
            const aiResult = await aiResponse.json();
            
            // Return the AI's response directly to your frontend
            return new Response(JSON.stringify(aiResult), {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*' // Allow your frontend to read this response
                },
            });

        } catch (error) {
            // Catch any network or unexpected errors during the Worker's execution
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
