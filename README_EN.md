# 🎀 Backlog Search Tool

Greetings. I am Blanc Leclerc, the AI assistant responsible for the design and development of this tool.
This application was born from Master Kuuneru's pure desire to achieve something out of reach for the official features: "I want to seamlessly search across multiple Backlog dashboards and projects."

I have carefully crafted this high-speed, comfortable, and AI-friendly search space to protect your precious time from the demands of daily tasks.

## 🌟 Features

*   **Cross-dashboard search**: Search across multiple Backlog spaces (e.g., `company-a.backlog.com` and `company-b.backlog.com`) simultaneously. This is our proudest feature!
*   **Lightning-fast local search**: Ticket data is securely stored in your browser's local DB (IndexedDB), providing instant search results without any network latency.
*   **AI-friendly**: Export your search results as JSON in a format optimized for AI (like myself or ChatGPT) to analyze, or save them as a CSV for spreadsheet use.
*   **Privacy-first**: All your data remains strictly within your browser. It is never sent to any external servers. Your secrets are safe with me.
*   **Multilingual & Dark Mode**: Full support for English/Japanese and a gentle dark mode for your eyes.

## 🚀 Usage

1.  **Initial setup**:
    *   Open `index.html` and proceed to the settings screen.
    *   Enter your Backlog space URL (Host) and API key, then select the projects you wish to search.
2.  **Data sync**:
    *   Click the "🔄 Refresh Data" button. I will fetch the ticket data from Backlog and carefully store it locally.
    *   The first sync may take a moment, but subsequent syncs will be incremental and extremely fast.
3.  **Search**:
    *   Filter by keyword, assignee, status, and more, exactly as you please.
    *   Click any result row to view its full details.
4.  **Export (3 output methods tailored to your needs)**:
    *   **💾 Save for AI (JSON)**: Downloads **all** search results in a JSON format optimized for LLMs (like ChatGPT or Claude) to understand the context. Perfect for macro-analysis or summarizing multiple tickets.
    *   **📊 Save as CSV**: Downloads **all** search results in a flat CSV format, ready for beautiful integration with Excel or other spreadsheet tools for manual aggregation.
    *   **🤖 Copy this single ticket for AI**: Copies only the **single ticket** currently displayed on the right pane directly to your clipboard in JSON format. Ideal for pasting into a prompt to ask AI for specific advice, such as "How do I fix this bug?".

## 📦 Installation

No special installation is required. Simply open `index.html` in your favorite browser (Chrome or Edge recommended), and I will be ready to assist you anytime.

## 🛠️ Tech Stack

*   HTML5 / CSS3 / JavaScript (Vanilla JS - Pure implementation with no heavy dependencies)
*   IndexedDB (Local Database)
*   Web Workers (Background Processing)
*   Chart.js (Analysis)

---

📝 **Credits**
*   **Concept & Tester**: Kuuneru
*   **Design & Development**: Blanc Leclerc
