import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: [
              'microphone=(self "https://api.razorpay.com" "https://checkout.razorpay.com")',
              'accelerometer=(self "https://api.razorpay.com" "https://checkout.razorpay.com")',
              'gyroscope=(self "https://api.razorpay.com" "https://checkout.razorpay.com")',
              'web-share=(self "https://api.razorpay.com" "https://checkout.razorpay.com")',
            ].join(', '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
