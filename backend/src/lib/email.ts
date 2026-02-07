export const getHtmlEmail = (title: string, message: string, buttonText?: string, buttonUrl?: string) => {
    const year = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f3f4f6;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            padding: 40px 0;
            text-align: center;
        }
        .logo {
            color: white;
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.5px;
            text-decoration: none;
        }
        .content {
            padding: 40px 32px;
            color: #374151;
            line-height: 1.6;
        }
        .title {
            font-size: 24px;
            font-weight: 700;
            color: #111827;
            margin-bottom: 24px;
            text-align: center;
        }
        .message {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 32px;
            text-align: center;
        }
        .button-container {
            text-align: center;
            margin: 32px 0;
        }
        .button {
            background-color: #10b981;
            color: white !important;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            display: inline-block;
            transition: background-color 0.2s;
            box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);
        }
        .button:hover {
            background-color: #059669;
        }
        .footer {
            background-color: #f9fafb;
            padding: 24px;
            text-align: center;
            font-size: 14px;
            color: #9ca3af;
            border-top: 1px solid #e5e7eb;
        }
        .footer p {
            margin: 8px 0;
        }
        .link {
            color: #10b981;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">FinTrack</div>
        </div>
        <div class="content">
            <h1 class="title">${title}</h1>
            <div class="message">
                ${message}
            </div>
            ${buttonText && buttonUrl ? `
            <div class="button-container">
                <a href="${buttonUrl}" class="button">${buttonText}</a>
            </div>
            ` : ''}
            <div class="message" style="font-size: 14px; color: #6b7280; margin-top: 32px;">
                If you didn't request this email, you can safely ignore it.
            </div>
        </div>
        <div class="footer">
            <p>&copy; ${year} FinTrack. All rights reserved.</p>
            <p>Track your finances with confidence.</p>
        </div>
    </div>
</body>
</html>
    `;
};
