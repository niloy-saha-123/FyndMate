declare module "*.svg" {
  import React from "react";
  // Structurally typed locally rather than importing `SvgProps` from
  // react-native-svg, which is not a dependency of this app.
  const content: React.FC<{
    width?: number | string;
    height?: number | string;
    fill?: string;
    color?: string;
    style?: unknown;
  }>;
  export default content;
}
