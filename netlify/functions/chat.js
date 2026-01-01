const PINECONE_API_KEY = process.env.PINECONE_API_KEY || process.env.VITE_PINECONE_API_KEY || "";
const PINECONE_CHAT_ENDPOINT = "https://prod-1-data.ke.pinecone.io/assistant/chat/lawchatbot";

exports.handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
            },
            body: "",
        };
    }

    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: "Method not allowed" }),
        };
    }

    try {
        if (!PINECONE_API_KEY) {
            console.error("PINECONE_API_KEY is not set in environment variables");
            return {
                statusCode: 500,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ 
                    error: "PINECONE_API_KEY environment variable is not configured" 
                }),
            };
        }

        const body = JSON.parse(event.body || "{}");

        console.log("Sending request to Pinecone:", PINECONE_CHAT_ENDPOINT);
        console.log("API Key present:", !!PINECONE_API_KEY);

        const response = await fetch(PINECONE_CHAT_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Api-Key": PINECONE_API_KEY,
                "Accept": "application/json, text/event-stream",
            },
            body: JSON.stringify({
                messages: body.messages,
                stream: false,
            }),
        });

        console.log("Pinecone response status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Pinecone error:", errorText);
            return {
                statusCode: response.status,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ error: errorText }),
            };
        }

        const data = await response.json();

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error("Function error:", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                error: error.message || "Internal server error"
            }),
        };
    }
};
