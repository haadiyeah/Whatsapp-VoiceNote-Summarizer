import json
import re
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

# Load the tokenizer and model
tokenizer = AutoTokenizer.from_pretrained("unsloth/gemma-2-9b-it-bnb-4bit")
model = AutoModelForCausalLM.from_pretrained("unsloth/gemma-2-9b-it-bnb-4bit")

# Move the model to GPU if available
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

# Define the input prompt
# input_prompt = """Summarise the following text in bullet points:
# This week we have the following tasks for our
# degree in international relations. First of all, we need
# to read pages 142 to 156 of the book Foreign Policy
# Analysis by George Goldstein. Number two, we
# need to write a book report on the book Politics and
# bureaucracy by Ibn Taymiye. Number three, we
# need to fill out the survey form sent on our
# WhatsApp group. And number four, we have to
# prepare for the final exams coming up next week,
# starting from 16th of December. All students are
# requested to download the date sheet sent on the
# portal and to ensure that they fully understand all the
# timings and the dates. All students are also required
# to download the admit cards from the portal if there
# is any issue they should contact admin immediately."""
text ="""
This week we have the following tasks for our
degree in international relations. First of all, we need
to read pages 142 to 156 of the book Foreign Policy
Analysis by George Goldstein. Number two, we
need to write a book report on the book Politics and
bureaucracy by Ibn Taymiye. Number three, we
need to fill out the survey form sent on our
WhatsApp group. And number four, we have to
prepare for the final exams coming up next week,
starting from 16th of December. All students are
requested to download the date sheet sent on the
portal and to ensure that they fully understand all the
timings and the dates. All students are also required
to download the admit cards from the portal if there
is any issue they should contact admin immediately."""
input_prompt = f"""Analyze the following text and provide a structured summary with exactly 5 key points. 
            Format the response as a valid JSON with numbered points. Each point should be clear and concise.
            
            Text to analyze: \n\n{text}\n\n
            
            Required JSON format:
            {{
                "summary": {{
                    "point1": "First key point here",
                    "point2": "Second key point here",
                    "point3": "Third key point here",
                    "point4": "Fourth key point here",
                    "point5": "Fifth key point here"
                }}
            }}
            
            Return only the JSON, no additional text."""


# Tokenize the input prompt
input_ids = tokenizer.encode(input_prompt, return_tensors="pt").to(device)

# Generate text
output = model.generate(input_ids, max_length=500, num_return_sequences=1)

# Decode the generated text
generated_text = tokenizer.decode(output[0], skip_special_tokens=True)
generated_text = generated_text.replace(input_prompt, "").strip().strip("*")
json_match = re.search(r'\{[\s\S]*\}', generated_text)
if json_match:
                try:
                    summary_json = json.loads(json_match.group())
                    
                except json.JSONDecodeError:
                    # Fallback structure if JSON parsing fails
                    summary_json = {"summary": {"point1": "Error parsing JSON", "point2": "Error parsing JSON", "point3": "Error parsing JSON", "point4": "Erro"}}
# Print the generated text
print(summary_json)
print(generated_text)