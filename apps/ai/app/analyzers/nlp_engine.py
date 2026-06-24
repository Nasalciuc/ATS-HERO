"""spaCy engine.

Loads the trained model (en_core_web_sm) when available — enabling POS tagging,
lemmatization, NER and noun-chunk extraction. When the model is not installed
(e.g. CI without the model download), it degrades to a blank English pipeline
with a rule-based sentencizer. Lexical attributes (`like_num`, `like_email`) and
sentence segmentation still work in that mode; the scorer falls back to heuristics
for the features that need the trained components.
"""
from functools import lru_cache

import spacy
from spacy.language import Language

from ..config import settings


class NlpEngine:
    def __init__(self, model_name: str) -> None:
        try:
            self.nlp: Language = spacy.load(model_name)
            self.model_loaded = True
            self.label = model_name
        except Exception:
            self.nlp = spacy.blank("en")
            if "sentencizer" not in self.nlp.pipe_names:
                self.nlp.add_pipe("sentencizer")
            self.model_loaded = False
            self.label = "blank(en)+heuristics"

    def __call__(self, text: str):
        return self.nlp(text)


@lru_cache(maxsize=1)
def get_engine() -> NlpEngine:
    """Process-wide singleton — the model is loaded once."""
    return NlpEngine(settings.spacy_model)
