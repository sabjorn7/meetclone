"""Compare rendered legal text and links with the reviewed Google Docs snapshot."""
import json,re
from pathlib import Path
from html.parser import HTMLParser
root=Path(__file__).resolve().parents[1]
class Document(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.parts=[];self.paragraphs=[];self.links=[];self.tables=0
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  assert tag in {'p','h2','strong','em','u','a'},tag
  assert set(attrs)<=({'href'} if tag=='a' else set())
  if tag=='a':self.links.append(attrs['href'])
 def handle_data(self,s):self.parts.append(s)
 def handle_endtag(self,tag):
  if tag in {'p','h2'}:self.paragraphs.append(''.join(self.parts));self.parts=[]
def norm(s):return ' '.join(s.split())
for doc in json.loads((root/'reviews/2026-11-20-speaker-legal/source-fidelity.json').read_text()):
 parser=Document();parser.feed((root/doc['file']).read_text())
 assert [norm(s) for s in parser.paragraphs]==[norm(s) for s in doc['paragraphs']],doc['file']
 assert parser.links==doc['links'],doc['file']
 assert not re.search(r'\[(?:УКАЗАТЬ|НАЗВАНИЕ|ФИО|СУММА)', ''.join(parser.paragraphs))
 print('PASS exact paragraphs, numbering, links:',doc['file'])
