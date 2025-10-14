import React from "react";

const Background: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <div className="">
      {children}
    </div>
  );
};

export default Background;