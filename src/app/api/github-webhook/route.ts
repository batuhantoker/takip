import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        // Parse the incoming GitHub Webhook payload
        const payload = await request.json();

        // Forward the payload to the local OSIRIS Discord Bot running on Port 3005
        // Using the Tailscale internal IP of the host server
        const response = await fetch('http://100.89.48.10:3005/github/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.error('Failed to forward webhook to Discord bot:', response.statusText);
            return NextResponse.json({ error: 'Failed to forward to bot' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Webhook forwarded successfully' }, { status: 200 });

    } catch (error) {
        console.error('Error handling GitHub webhook:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
