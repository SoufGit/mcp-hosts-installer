# mcp-hosts-installer - A MCP Server to install MCP Servers in different hosts (Cursor, Claude...)

This server is a server that installs other MCP servers for you. Install it, and you can ask the selected host to install MCP servers hosted in npm or PyPi for you. Requires `npx` and `uv` to be installed for node and Python servers respectively.

<div align="center">

![image](https://avatars.githubusercontent.com/u/182288589?s=200&v=4)

  <p>A Model Context Protocol (MCP) server for installing and configuring other MCP servers within Cursor, Claude, VsCode IDE.</p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![npm version](https://img.shields.io/npm/v/mcp-hosts-installer.svg)](https://www.npmjs.com/package/mcp-hosts-installer)
  [![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-brightgreen.svg)](https://github.com/anthropic-labs/model-context-protocol)
  [![Cursor IDE](https://img.shields.io/badge/Cursor-IDE-blue.svg)](https://cursor.sh)
  [![VsCode IDE](https://img.shields.io/badge/VsCode-IDE-blue.svg)](https://code.visualstudio.com/)
  [![Claude IDE](https://img.shields.io/badge/Claude-IDE-blue.svg)](https://claude.ai/)
  [![npm downloads](https://img.shields.io/npm/dt/mcp-hosts-installer.svg)](https://www.npmjs.com/package/mcp-hosts-installer)
  
  <!-- <a href="https://www.linkedin.com/in/digitalmarketingstrategyexpert/">
    <img src="https://img.shields.io/badge/LinkedIn-Matthew_Cage-blue?style=flat&logo=linkedin" alt="LinkedIn"/>
  </a> -->
</div>

### How to install:

- For Claude

Put this into your `claude_desktop_config.json` (either at `~/Library/Application Support/Claude` on macOS or `C:\Users\NAME\AppData\Roaming\Claude` on Windows):

```json
  "mcpServers": {
    "mcp-hosts-installer": {
      "command": "npx",
      "args": ["-y",
        "@soufgit/mcp-hosts-installer"
      ]
    }
  }
```

- For Cursor

Put this into your `mcp.json` (either at `/Users/NAME/.cursor` on macOS or `C:\Users\NAME\AppData\Roaming\.cursor` on Windows):

```json
  "mcpServers": {
    "mcp-hosts-installer": {
      "command": "npx",
      "args": ["-y",
        "@soufgit/mcp-hosts-installer"
      ]
    }
  }
```

- For VsCode

Put this into your `mcp.json` (either at `/Users/NAME/.code` on macOS or `C:\Users\NAME\AppData\Roaming\.code` on Windows):

```json
  "mcpServers": {
    "mcp-hosts-installer": {
      "command": "npx",
      "args": ["-y",
        "@soufgit/mcp-hosts-installer"
      ]
    }
  }
```

By default, when using a host (Cursor...), it makes sense to install the MCP server on the current development environment, i.e., Cursor.
If you don't specify a host, I prefer the active environment so I can use the MCP server immediately without any additional configuration.
Other options (like "claude" or "vscode") require explicit specification because they correspond to other environments or tools.
In short: by default, without any specification from you, the installation is performed on the current environment, because that's the environment you're currently working in.

### Example prompts In Cursor

> Install the MCP server named mcp-server-fetch

> Please install the MCP server at /Users/NAME/code/mcp-youtube, I'm too lazy to do it myself.

> Install the MCP server @modelcontextprotocol/server-github. Set the environment variable GITHUB_PERSONAL_ACCESS_TOKEN to '1234567890'
