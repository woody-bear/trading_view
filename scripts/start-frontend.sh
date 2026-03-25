#!/bin/bash
export PATH="/Users/woody/.nvm/versions/node/v24.14.0/bin:$PATH"
cd /Users/woody/workflow/trading_view/frontend
exec npx serve dist -l 3000 -s --no-clipboard 2>&1
