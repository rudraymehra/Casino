import React from "react";

export default function GradientBorderButton({ children, classes, className, onClick, href }) {
  const buttonContent = (
    <div
      className={`bg-gradient-to-r from-red-magic to-blue-magic hover:from-blue-magic hover:to-red-magic rounded-sm p-0.5 cursor-pointer ${classes || ''} ${className || ''}`}
      onClick={onClick}
    >
      <div className="bg-[#070005] rounded-sm px-4 h-full justify-center font-display py-1 flex items-center text-white">
        {children}
      </div>
    </div>
  );

  // If href is provided, wrap in an anchor tag for proper navigation
  if (href) {
    return (
      <a href={href} className="block">
        {buttonContent}
      </a>
    );
  }

  return buttonContent;
}
