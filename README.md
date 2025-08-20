# Simulon Command Center (Flask)

A minimal, clean starting point for your Simulon Command Center, with tabbed UI and JSON API stubs.

## Run locally

```bash
python3 -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
# open http://127.0.0.1:5000
```

## Where things live
- `app.py` — Flask server and API stubs
- `templates/base.html` — shared layout
- `templates/index.html` — tabbed UI
- `static/css/style.css` — theme + layout
- `static/js/main.js` — tab switching + API calls


### Sample SimuLang to try

```
posit varnothing nabla infty ds2(): {
  delineator "hello": {
    print("Simulon Online");
  }
  intertillage [1..5] -> i: {
    print(i);
  }
  recur ds2(5);
}
```
