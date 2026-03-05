"use client";

import React from "react";

export function AnimatedBackground() {
    return (
        <div className="absolute inset-0 z-0 overflow-hidden bg-primary/20">
            <svg
                className="absolute w-full h-full opacity-30"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1000 1000"
                preserveAspectRatio="xMidYMid slice"
            >
                <defs>
                    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0.1" />
                    </linearGradient>
                    <linearGradient id="grad2" x1="100%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                    </linearGradient>
                    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="50" />
                    </filter>
                </defs>

                {/* Animated Orbs */}
                <g filter="url(#blur)">
                    <circle cx="200" cy="200" r="150" fill="url(#grad1)">
                        <animate
                            attributeName="cx"
                            values="150; 250; 150"
                            dur="15s"
                            repeatCount="indefinite"
                        />
                        <animate
                            attributeName="cy"
                            values="150; 250; 150"
                            dur="20s"
                            repeatCount="indefinite"
                        />
                    </circle>
                    <circle cx="800" cy="800" r="250" fill="url(#grad2)">
                        <animate
                            attributeName="cx"
                            values="700; 900; 700"
                            dur="18s"
                            repeatCount="indefinite"
                        />
                        <animate
                            attributeName="cy"
                            values="900; 700; 900"
                            dur="22s"
                            repeatCount="indefinite"
                        />
                    </circle>
                    <circle cx="800" cy="200" r="200" fill="url(#grad1)">
                        <animate
                            attributeName="cx"
                            values="750; 850; 750"
                            dur="25s"
                            repeatCount="indefinite"
                        />
                        <animate
                            attributeName="cy"
                            values="150; 250; 150"
                            dur="15s"
                            repeatCount="indefinite"
                        />
                    </circle>
                    <circle cx="200" cy="800" r="300" fill="url(#grad2)">
                        <animate
                            attributeName="cx"
                            values="100; 300; 100"
                            dur="22s"
                            repeatCount="indefinite"
                        />
                        <animate
                            attributeName="cy"
                            values="700; 900; 700"
                            dur="18s"
                            repeatCount="indefinite"
                        />
                    </circle>
                </g>
            </svg>
            {/* Overlay to ensure text readability */}
            <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]"></div>
        </div>
    );
}
