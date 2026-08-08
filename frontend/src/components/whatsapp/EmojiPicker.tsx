"use client";

// Emoji picker ringan & mandiri (tanpa dependency eksternal) — ramah offline.
const EMOJI_GROUPS: Record<string, string[]> = {
    "Wajah": ["😀", "😁", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😎", "🤩", "🥳", "😅", "😆", "😜", "🤗", "🤔", "😐", "😴", "😷", "🥺", "😢", "😭", "😤", "😡", "😳", "🙄"],
    "Tangan": ["👍", "👎", "👌", "🤝", "🙏", "👏", "🙌", "💪", "✌️", "🤞", "🤙", "👋", "☝️", "✋", "🖐️", "🤟", "👉", "👈"],
    "Hati & Simbol": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "💕", "💯", "✨", "🔥", "🎉", "⭐", "🌟", "❣️", "💬"],
    "Bisnis": ["✅", "❌", "⚠️", "📌", "📎", "📷", "📄", "💰", "🛒", "📦", "🚚", "🕐", "📞", "🎁", "🏷️", "✏️", "🖨️", "🧾"],
};

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
    return (
        <div className="w-64 max-h-64 overflow-y-auto rounded-xl border border-border bg-card shadow-lg p-2 space-y-2">
            {Object.entries(EMOJI_GROUPS).map(([cat, list]) => (
                <div key={cat}>
                    <div className="text-[10px] uppercase tracking-wide opacity-50 px-1 mb-1">{cat}</div>
                    <div className="grid grid-cols-8 gap-0.5">
                        {list.map((e) => (
                            <button
                                key={e}
                                type="button"
                                onClick={() => onPick(e)}
                                className="text-xl leading-none p-1 rounded hover:bg-muted transition-colors"
                                aria-label={`emoji ${e}`}
                            >
                                {e}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
