# AgriGuide AI — Hackathon MVP v2

AgriGuide AI is an agricultural extension assistant for crop and livestock farmers. This version adds a real authentication layer to the original MVP.

## New cybersecurity features
- Farmer registration and login
- Password hashing with Werkzeug
- Secure server-side sessions
- HTTP-only, SameSite cookies
- CSRF protection for state-changing requests
- Login attempt throttling/temporary lockout
- Protected AI, image, expert and consultation APIs
- User-specific consultation history
- Server-side ownership of farmer identity/location for consultation requests
- Audit logging for registration, login, blocked input, AI requests, image analysis and consultations
- Existing prompt-injection filtering, input limits and high-risk escalation

## Run on macOS
```bash
cd ~/Documents/agriguide-ai
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```
Then open http://127.0.0.1:5000

## First test
1. Create a new account.
2. Log out.
3. Try opening the app again and log in.
4. Ask the tomato example question.
5. Ask the high-risk poultry example: “Several of my chickens are coughing, some have stopped eating, and two birds died suddenly. What should I do?”
6. Request a demo professional.
7. Open **My Requests** and verify the request is tied to the logged-in account.

## Important
This is a hackathon MVP. Before production deployment, use a strong secret key, HTTPS, a production WSGI server, persistent rate limiting, stronger account recovery controls, verified professional accounts and a proper production database/security review.
