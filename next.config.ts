import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            // Allow Razorpay iframe (dynamically created, can't set allow= attribute)
            // to access sensors it needs for fraud detection.
            key: 'Permissions-Policy',
            value: [
              'microphone=(self "https://api.razorpay.com" "https://checkout.razorpay.com")',
              'accelerometer=*',
              'gyroscope=*',
              'web-share=*',
            ].join(', '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
