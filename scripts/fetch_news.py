import os
import json
import datetime
import uuid
import google.generativeai as genai

# Configuración
API_KEY = os.environ.get('GEMINI_API_KEY')
NEWS_FILE = 'news.json'

if not API_KEY:
    print("Error: No se encontró la variable de entorno GEMINI_API_KEY.")
    exit(1)

genai.configure(api_key=API_KEY)

# Prompt estricto para asegurar formato JSON
PROMPT = """
Eres un experto analista de ciberseguridad. 
Dame entre 3 y 5 de las noticias, vulnerabilidades o herramientas de ciberseguridad más relevantes y recientes del día de hoy.
DEBES responder ÚNICA Y EXCLUSIVAMENTE con un array en formato JSON válido. No uses bloques de código Markdown (```json) ni texto adicional antes o después.
El formato de cada objeto debe ser estricto:
[
  {
    "title": "Título corto y descriptivo",
    "content": "Descripción detallada del problema, herramienta o vulnerabilidad (puedes usar **negritas**).",
    "tag": "VULN" // Usa VULN, TOOL, MALWARE o INFO
  }
]
"""

def fetch_cyber_news():
    try:
        # Usamos gemini-pro (gemini-1.5-pro o gemini-1.5-flash)
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        response = model.generate_content(PROMPT)
        
        # Limpiar respuesta por si acaso la IA incluye bloques markdown
        raw_text = response.text.strip()
        if raw_text.startswith('```json'):
            raw_text = raw_text[7:]
        if raw_text.startswith('```'):
            raw_text = raw_text[3:]
        if raw_text.endswith('```'):
            raw_text = raw_text[:-3]
            
        new_items = json.loads(raw_text.strip())
        
        # Enriquecer con IDs y fechas
        current_date = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        for item in new_items:
            item['id'] = str(uuid.uuid4())
            item['date'] = current_date
            
        return new_items
    except Exception as e:
        print(f"Error al obtener o parsear datos de Gemini: {e}")
        return []

def update_news_file(new_items):
    if not new_items:
        print("No hay noticias nuevas para actualizar.")
        return

    existing_news = []
    if os.path.exists(NEWS_FILE):
        try:
            with open(NEWS_FILE, 'r', encoding='utf-8') as f:
                existing_news = json.load(f)
        except Exception:
            pass # Si falla al leer, iniciamos de cero
            
    # Añadir nuevas al principio
    combined_news = new_items + existing_news
    
    # Limitar a las últimas 50 noticias para no llenar el archivo
    combined_news = combined_news[:50]
    
    with open(NEWS_FILE, 'w', encoding='utf-8') as f:
        json.dump(combined_news, f, ensure_ascii=False, indent=2)
    print(f"Se añadieron {len(new_items)} noticias correctamente.")

if __name__ == '__main__':
    print("Iniciando extracción de inteligencia...")
    news = fetch_cyber_news()
    update_news_file(news)
    print("Proceso finalizado.")
