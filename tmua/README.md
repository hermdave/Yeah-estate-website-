# TMUA Study Desk

Dashboard: https://claude.ai/artifact/LaJx66NgtreYijYxKvoiqw. It's private, works on a phone, and your data syncs between devices.
To run it locally instead: `python3 tmua/tools/fetch_papers.py` once, then `python3 tmua/tools/serve.py --lan`.

## Daily workflow

1. **Open Today.** Do the redos listed under *Due for redo today*. Reattempt each question cold from the paper, then tap **Got it** or **Missed again**. Missed questions come back in 3 days.
2. **Do one timed block.** Choose one:
   - **A timed paper:** Papers → *Timed*. Tap a question number when you move to it, so the clock knows where your time goes. Tap ⚑ on any guess or skip.
   - **A practice set:** Practice → 5–10 questions at 3.5 minutes each, preselected on your weakest topics.
3. **Mark it and give reasons.** Finish & mark, then give each flagged question one reason tap. Questions that took over 4.5 minutes are logged as *slow* automatically.
4. **Check the worked answers** for anything wrong, guessed or slow.
5. **Twice a week, check Progress.** Look at your weakest topics and minutes per paper. Then ask Claude to *"generate 10 questions on my 3 weakest topics"*.

**Late December:** sit 2021–2023 as full timed mocks. They're under *Mock reserve*, and starting one takes two taps so you can't open one by accident.
