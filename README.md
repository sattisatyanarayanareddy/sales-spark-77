# SalesCRM - Sales Pipeline Management System

A modern, full-featured CRM application for managing sales quotations, team members, and sales pipeline.

## Features

- 🔐 **Firebase Authentication** - Secure email/password authentication with password reset
- 👥 **Team Management** - Role-based access control (General Manager, Sub Manager, Sales)
- 📋 **Quotation Management** - Create, track, and export quotations with product details
- 🖼️ **Image Storage** - Cloudinary integration for product images
- 📄 **PDF Export** - Generate professional quotations with images and branding
- 📊 **Dashboard Analytics** - Real-time sales metrics and performance tracking
- 🎨 **Modern UI** - Built with Shadcn UI and Tailwind CSS

## User Roles

- **General Manager**: Full system access, can manage all users and quotations
- **Sub Manager**: Can add/edit/delete sales users and manage quotations
- **Sales**: Can create and manage their own quotations

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI Framework**: Shadcn UI, Tailwind CSS
- **Backend**: Firebase (Authentication & Firestore Database)
- **Storage**: Cloudinary
- **PDF Generation**: jsPDF, html2canvas
- **Routing**: React Router v6

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or bun package manager
- Firebase project with Firestore enabled
- Cloudinary account

### Installation

1. Clone the repository:
```sh
git clone <YOUR_GIT_URL>
cd sales-spark-77
```

2. Install dependencies:
```sh
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
```

4. Start the development server:
```sh
npm run dev
```

The application will be available at `http://localhost:8080`

## Building for Production

```sh
npm run build
```

The built files will be in the `dist` directory.

## Deployment

### Deploy to Vercel

1. Install Vercel CLI:
```sh
npm install -g vercel
```

2. Deploy:
```sh
vercel
```

3. Set environment variables in Vercel dashboard (Project Settings > Environment Variables)

**Note**: Vercel deployments are public by default. Anyone with the URL can access your application.

### Alternative Deployment Options

- **Netlify**: Connect your Git repository and deploy automatically
- **Firebase Hosting**: `firebase deploy` after configuring firebase.json
- **AWS S3 + CloudFront**: Static hosting with CDN

## Project Structure

```
src/
├── components/      # Reusable UI components
├── contexts/        # React contexts (Auth, etc.)
├── hooks/           # Custom React hooks
├── lib/             # Utilities and services
│   ├── firebase.ts          # Firebase config
│   ├── firestore-service.ts # Database operations
│   └── cloudinary.ts        # Image upload
├── pages/           # Route pages
├── types/           # TypeScript types
└── main.tsx         # Application entry point
```

## License

Private - All rights reserved
