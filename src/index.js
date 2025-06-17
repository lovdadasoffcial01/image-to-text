
export interface Env {
    AI: Ai; // This type declaration is for TypeScript, but good to include for clarity
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        // --- 1. Handle CORS Preflight Requests (OPTIONS method) ---
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Max-Age': '86400',
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
        
        const { image, prompt } = requestData; // 'image' here is the base64 Data URI from frontend

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
        // Extract the base64 part (remove "data:image/...;base64,")
        const base64Data = image.split(',')[1];
        let imageUint8Array;
        try {
            // Decode the base64 string
            const binaryString = atob(base64Data);
            // Convert binary string to Uint8Array
            imageUint8Array = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
        } catch (e) {
            return new Response(JSON.stringify({ message: 'Failed to decode base64 image data.' }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
            });
        }

        // --- 5. Call Cloudflare Workers AI using the `env.AI` binding ---
        // The `env.AI.run()` method takes the model ID and an input object.
        // It handles authentication and URL construction internally.
        const modelId = "@cf/llava-hf/llava-1.5-7b-hf"; // Correct model ID as per docs
        const aiInput = {
            messages: [
                {
                    role: "user",
                    content: prompt,
                    image: [...imageUint8Array] // Pass as an array of numbers (Uint8Array contents)
                }
            ],
            max_tokens: 512, // As per docs, a good default for descriptions
        };

        try {
            // Make the call to the Cloudflare AI binding
            const aiResult = await env.AI.run(modelId, aiInput);
            
            // --- 6. Return AI Result to Frontend ---
            // aiResult will contain the 'description' field as per the documentation.
            return new Response(JSON.stringify(aiResult), {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
            });

        } catch (error: any) { // Use 'any' for error type if not strictly TypeScript
            // --- 7. Handle Errors from AI Binding ---
            console.error("Worker error during AI binding call:", error);
            // The AI binding error might be a string or object.
            const errorMessage = typeof error === 'string' ? error : (error.message || 'Unknown error from Cloudflare AI binding');
            return new Response(JSON.stringify({ message: `AI model error: ${errorMessage}` }), {
                status: 500, // A 500 status indicates an issue on the server (Worker) side during AI call
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
            });
        }
    },
} satisfies ExportedHandler<Env>; // Use satisfies ExportedHandler<Env> for better type checking
