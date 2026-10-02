// SEMA-GOVERNED: sema.produto.gerador_python_verificacao
// Contrato: contratos/sema/gerador_python_verificacao.sema
// Descrição: acesso uniforme a mapas e entidades e síntese demonstrativa de garantias.
export const RUNTIME_PYTHON = `
import math

def sema_get(objeto, caminho):
    for campo in caminho:
        if objeto is None:
            return None
        objeto = objeto.get(campo) if isinstance(objeto, dict) else getattr(objeto, campo, None)
    return objeto

def sema_set(objeto, caminho, valor):
    for campo in caminho[:-1]:
        filho = sema_get(objeto, [campo])
        if filho is None:
            filho = {} if isinstance(objeto, dict) else SimpleNamespace()
            if isinstance(objeto, dict):
                objeto[campo] = filho
            else:
                setattr(objeto, campo, filho)
        if not isinstance(filho, dict) and not hasattr(filho, "__dict__"):
            raise ValueError(f"Caminho de objeto incompatível: {campo}")
        objeto = filho
    if isinstance(objeto, dict):
        objeto[caminho[-1]] = valor
    else:
        setattr(objeto, caminho[-1], valor)

def sema_sintetizar(atual, restricoes, inteiro=False):
    # Apenas valores demonstrativos: expect nunca participa desta síntese.
    def aceita(valor):
        for operador, limite in restricoes:
            if operador == "existe" and valor is None:
                return False
            if operador == "in" and valor not in limite:
                return False
            try:
                if operador == "==" and valor != limite: return False
                if operador == "!=" and valor == limite: return False
                if operador == ">" and not valor > limite: return False
                if operador == ">=" and not valor >= limite: return False
                if operador == "<" and not valor < limite: return False
                if operador == "<=" and not valor <= limite: return False
            except TypeError:
                return False
        return True

    candidatos = [atual]
    numeros = []
    for operador, limite in restricoes:
        if operador == "in":
            candidatos.extend(limite)
        elif operador != "existe":
            candidatos.append(limite)
            if isinstance(limite, (int, float)) and not isinstance(limite, bool):
                numeros.append(limite)
                candidatos.extend([limite - 1, limite + 1, math.floor(limite), math.ceil(limite)])
    numeros.sort()
    candidatos.extend((a + b) / 2 for a, b in zip(numeros, numeros[1:]))
    candidatos.extend([1, 0, -1, True, False, "valor_garantido", "outro_valor"])
    for candidato in candidatos:
        if inteiro and (not isinstance(candidato, int) or isinstance(candidato, bool)):
            continue
        if aceita(candidato):
            return candidato
    raise ValueError("Não foi possível sintetizar saída demonstrativa compatível com as garantias; forneça implementação real.")
`;
