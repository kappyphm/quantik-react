import {tokenizeTerms} from '../content/term-aliases.js';
import TermHint from './TermHint.jsx';

export default function AnnotatedText({text}) {
  return tokenizeTerms(text).map((part,index)=>part.id
    ? <TermHint key={index} id={part.id}>{part.text}</TermHint>
    : part.text);
}
