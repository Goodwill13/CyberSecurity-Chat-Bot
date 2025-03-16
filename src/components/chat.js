import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import "./chat.css";

const Chat = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [chatOpen, setChatOpen] = useState(false);
    const socketRef = useRef(null);
    const chatBoxRef = useRef(null);

    useEffect(() => {
        socketRef.current = io("http://localhost:5000");

        socketRef.current.on("bot_response", (data) => {
            // Only remove error message, keep the exact response otherwise
            const cleanResponse = data.response
                .replace("Error processing request.", "");

            if (!cleanResponse) return;

            setMessages((prevMessages) => {
                const newMessages = [...prevMessages];
                const lastMessage = newMessages[newMessages.length - 1];
                
                if (lastMessage && !lastMessage.isUser) {
                    // Check if this chunk would create a duplicate in the text
                    const currentText = lastMessage.text;
                    // Only add the chunk if it's not already part of the message
                    if (!currentText.endsWith(cleanResponse)) {
                        lastMessage.text += cleanResponse;
                    }
                    return newMessages;
                } else {
                    return [...prevMessages, { text: cleanResponse, isUser: false }];
                }
            });
        });

        return () => socketRef.current.disconnect();
    }, []);

    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [messages]);

    const toggleChat = () => {
        setChatOpen((prev) => !prev);
    };

    const sendMessage = () => {
        if (input.trim()) {
            setMessages((prev) => [...prev, { text: input.trim(), isUser: true }]);
            socketRef.current.emit("message", { message: input.trim() });
            setInput("");
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div id="chat-container" className={chatOpen ? "open" : ""}>
            <div className="chat-header" onClick={toggleChat}>
                Chat with Us!
            </div>
            <div id="chat-box" ref={chatBoxRef}>
                {messages.map((msg, index) => (
                    <div key={index} className={msg.isUser ? "user-message" : "bot-message"}>
                        {msg.text}
                    </div>
                ))}
            </div>
            {chatOpen && (
                <div className="input-box">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your message..."
                    />
                    <button onClick={sendMessage}>Send</button>
                </div>
            )}
        </div>
    );
};

export default Chat;
