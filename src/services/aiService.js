// Simple rule-based AI for demonstration
// Use OpenAI/Gemini API here for real intelligence

exports.generateResponse = async (message) => {
    // Simulate "thinking" delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
        return 'Hello there! I am the AI Bot. How can I help you today? 🤖';
    }

    if (lowerMsg.includes('how are you')) {
        return 'I am just code, but I feel great! Thanks for asking.';
    }

    if (lowerMsg.includes('help')) {
        return 'I can help you test this chat app. Try asking for a "joke" or the "time"!';
    }

    if (lowerMsg.includes('time')) {
        return `The current server time is ${new Date().toLocaleTimeString()}.`;
    }

    if (lowerMsg.includes('date')) {
        return `Today's date is ${new Date().toLocaleDateString()}.`;
    }

    if (lowerMsg.includes('joke')) {
        return 'Why did the developer go broke? Because he used up all his cache! 😂';
    }

    if (lowerMsg.includes('weather')) {
        return 'I cannot see outside, but in the cloud it is always partially sunny! ☁️';
    }

    return "That's interesting! Tell me more. (I'm currently running in simulation mode)";
};
