"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../index.js");
class DiscordContextProvider extends index_js_1.BaseContextProvider {
    constructor() {
        super(...arguments);
        this.baseUrl = "https://discord.com/api/v10";
    }
    // Helper function to get the full fetch URL
    getUrl(path) {
        return `${this.baseUrl}${path}`;
    }
    get deprecationMessage() {
        return "The Discord context provider is now deprecated and may be removed in a later version. Please consider using the Discord MCP (hub.docker.com/r/mcp/mcp-discord) instead.";
    }
    async fetchMessages(channelId, fetch) {
        const url = this.getUrl(`/channels/${channelId}/messages`);
        // Fetch messages from the specified channel using the provided fetch function
        const response = await fetch(url, {
            headers: {
                Authorization: `Bot ${this.options.discordKey}`,
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch messages: ${response.statusText}`);
        }
        return response.json();
    }
    async fetchChannels(fetch) {
        const url = this.getUrl(`/guilds/${this.options.guildId}/channels`);
        const response = await fetch(url, {
            headers: {
                Authorization: `Bot ${this.options.discordKey}`,
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch channels: ${response.statusText}`);
        }
        const channels = await response.json();
        // Filter channels to only include text channels (type 0)
        return channels.filter((channel) => channel.type === 0);
    }
    async getContextItems(query, extras) {
        const channels = await this.fetchChannels(extras.fetch);
        let channelId;
        // Find the channel by ID or name in the query string. If not found, use the first channel
        const selectedChannel = channels.find((channel) => channel.id === query || channel.name === query);
        channelId = selectedChannel ? selectedChannel.id : channels[0].id;
        const parts = ["# Discord Channel Messages", `Channel ID: ${channelId}`];
        const messages = await this.fetchMessages(channelId, extras.fetch);
        if (messages.length > 0) {
            parts.push("## Messages");
            // Format each message into a markdown string
            messages.forEach((message) => {
                parts.push(`### ${message.author?.username ?? "Unknown User"} on ${message.timestamp}\n\n${message.content}`);
            });
        }
        else {
            parts.push("No messages found.");
        }
        const content = parts.join("\n\n");
        return [
            {
                name: `Messages from Channel ${channelId}`,
                content,
                description: "Latest messages from the channel",
            },
        ];
    }
    async loadSubmenuItems(args) {
        const channels = await this.fetchChannels(args.fetch);
        return channels.map((channel) => ({
            id: channel.id,
            title: channel.name || `Channel ${channel.id}`,
            description: channel.topic ?? "",
        }));
    }
}
DiscordContextProvider.description = {
    title: "discord",
    displayTitle: "Discord",
    description: "Select a channel",
    type: "submenu",
};
exports.default = DiscordContextProvider;
//# sourceMappingURL=DiscordContextProvider.js.map