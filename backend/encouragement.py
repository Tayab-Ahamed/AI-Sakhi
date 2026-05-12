import random

ENCOURAGEMENT_BANK = {
    "perfect": [
        "Wah! Perfect score! 🌟 You're absolutely brilliant — keep it up!",
        "100%! You've totally mastered this topic! 🌸 Sakhi is so proud of you!",
        "Amazing! You got everything right! 🎉 You're going to ace your exams!",
    ],
    "great": [
        "Almost perfect! 🌟 You clearly understand this well. One more review and you'll nail it!",
        "Really great work! 🌸 You're improving so fast — keep going!",
        "Wonderful! That's a fantastic score! 🎉 You should feel proud!",
    ],
    "good": [
        "Good effort! 🌸 You're getting the hang of it — let's review the tricky ones together.",
        "You're improving! 💪 That's great progress. Let's strengthen the rest!",
        "Well done for trying! 🌟 Every attempt makes you smarter. Want to go again?",
    ],
    "needs_practice": [
        "Almost there! 🌸 Don't worry — even the best students need practice. Let's try again!",
        "You're learning! 💪 Mistakes are how we grow. Sakhi believes in you!",
        "Keep going! 🌟 You're understanding the basics — let's build on that!",
    ],
    "keep_trying": [
        "It's okay! 🌸 Every expert was once a beginner. Let's break this down step by step!",
        "You're brave for trying! 💪 Let's start from the beginning — Sakhi will explain it differently.",
        "Don't give up! 🌟 The fact that you're here means you WANT to learn. That's what matters!",
    ],
}

MID_SESSION = [
    "You're doing great! 🌸 Keep asking questions — that's how the best students learn!",
    "I love your curiosity! ✨ Every question you ask makes you stronger.",
    "You're on a learning streak! 🌟 Sakhi is proud of you!",
    "Great question! 💪 Asking doubts is a sign of real intelligence.",
    "Keep it up! 🌸 You're showing real dedication today!",
]


def get_encouragement(score: int, total: int = 5) -> str:
    pct = score / total if total > 0 else 0
    if pct == 1.0:
        return random.choice(ENCOURAGEMENT_BANK["perfect"])
    elif pct >= 0.8:
        return random.choice(ENCOURAGEMENT_BANK["great"])
    elif pct >= 0.6:
        return random.choice(ENCOURAGEMENT_BANK["good"])
    elif pct >= 0.4:
        return random.choice(ENCOURAGEMENT_BANK["needs_practice"])
    else:
        return random.choice(ENCOURAGEMENT_BANK["keep_trying"])


def get_mid_session_encouragement() -> str:
    return random.choice(MID_SESSION)
