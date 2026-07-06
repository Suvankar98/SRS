This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## WhatsApp Notification On Allocation

When a call is allocated to an employee, the app can send a WhatsApp message to that employee.

### 1) Add Twilio WhatsApp environment variables

Set these values in your `.env` file:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=+14155238886
PROJECT_LINK=https://your-deployed-app-url.example.com
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Notes:
- `TWILIO_WHATSAPP_FROM` must be your Twilio WhatsApp-enabled sender number.
- Employee WhatsApp numbers should be saved in international format, for example `+919876543210`.
- `GOOGLE_MAPS_API_KEY` must have Maps Places API enabled for the area autocomplete feature.
- On deployment (Vercel/Render/etc.), add these same variables in the project environment settings.
- Set `PROJECT_LINK` to your deployed app URL if you want it included in allocation messages.

### 1.1) What gets sent on allocation

When a manager/admin allocates a service call to an employee, the employee receives:
- Docket number
- Customer name
- Company
- Primary and alternate phone (if available)
- Full address
- Area
- Product
- Call type
- Project link

### 2) Sync schema changes

This feature adds `whatsappNumber` to users. Run:

```bash
npm run db:push
```

Then restart the app.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

Note: Project now uses MongoDB Atlas. Set `DATABASE_URL` in `.env` to your Atlas connection string.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
