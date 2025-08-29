// This serverless function acts as a secure proxy to the Fish Audio API.
// It receives the request from the client-side, attaches the secret credentials,
// and forwards the request to the Fish Audio API. This avoids exposing the API
// token to the browser and bypasses CORS issues.

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { text, token, voiceId } = await req.json();

        if (!text || !token || !voiceId) {
            return new Response(JSON.stringify({ error: 'Missing required parameters: text, token, voiceId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const API_URL = "https://api.fish.audio/v1/tts";
        const fishAudioResponse = await fetch(API_URL, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                "reference_id": voiceId,
                "text": text,
            }),
        });
        
        // Check if the response from Fish Audio is successful and is audio
        if (fishAudioResponse.ok && fishAudioResponse.headers.get('Content-Type')?.includes('audio')) {
             // Stream the audio back to the client
            return new Response(fishAudioResponse.body, {
                status: 200,
                headers: {
                    'Content-Type': fishAudioResponse.headers.get('Content-Type') || 'audio/mpeg',
                },
            });
        } else {
            // Fish Audio returned an error or unexpected content type
            const errorBody = await fishAudioResponse.text();
            let errorMessage = `Fish Audio API failed with status: ${fishAudioResponse.status}`;
            try {
                // Try to parse as JSON for a more specific error message
                const errorJson = JSON.parse(errorBody);
                errorMessage = errorJson.detail || errorMessage;
            } catch (e) {
                 if (errorBody) {
                    errorMessage += ` - ${errorBody}`;
                }
            }
             return new Response(JSON.stringify({ error: errorMessage }), {
                status: fishAudioResponse.status,
                headers: { 'Content-Type': 'application/json' },
            });
        }

    } catch (error) {
        console.error("Error in /api/tts proxy:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown internal error occurred.";
        return new Response(JSON.stringify({ error: "Internal Server Error", message: errorMessage }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
