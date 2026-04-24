#!/bin/bash

# Install all Radix UI dependencies explicitly
npm install --save \
  @radix-ui/react-checkbox \
  @radix-ui/react-switch \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-select \
  @radix-ui/react-progress \
  @radix-ui/react-alert-dialog \
  @radix-ui/react-tabs

# Run the build
npm run build 