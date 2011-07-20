var sigaafacil = function () {
	var prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	return {
		init : function () {
			gBrowser.addEventListener("load", function (event) {
				var autoRun = prefManager.getBoolPref("extensions.sigaafacil.autorun");
				if (autoRun) {
					sigaafacil.run(event);
				}
			}, true);
		},
		
		/**
		 * Adiciona o arquivo de estilos utilizado pelo SIGAA Fácil na página
		 */
		addStylesheet: function(document) {
			var head = document.getElementsByTagName("head")[0],
			style = document.getElementById("sigaafacil_style");
		
			if (!style) {
				style = document.createElement("link");
				style.id = "sigaafacil_style";
				style.type = "text/css";
				style.rel = "stylesheet";
				style.href = "chrome://sigaafacil/skin/skin.css";
				head.appendChild(style);
				return true;
			} else {
				return false;
			}
		},
		
		REGEX_HORARIO: /([1-7]+)([MTN])([0-9]+)/,
		
		TABELA_DIAS: [null, "Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
		
		/**
		 * Formata os dias do horário. Exemplo: Se o horário é 35M24, a entrada 
		 * da função é formatarHora("35") e a saída será "3ª 5ª".
		 */
		formatarDias: function(stringDias) {
			var dias = stringDias.split("");
			var diasFormatado = "";
			for (var i = 0; i < dias.length; i++) {
				if (i > 0) {
					diasFormatado += " ";
				}
				diasFormatado += this.TABELA_DIAS[parseInt(dias[i])];
			}
			return diasFormatado;
		},
		
		/**
		 * Formata as horas do horário. Exemplo: Se o horário é 35M24, a entrada 
		 * da função é formatarHora("24", "M") e a saída será "8:00 - 10:00".
		 */
		formatarHoras: function(stringIndicesHoras, turno) {
			//Os índices de hora são números no intervalo [0,...,9]	
			var indiceHoraInicial = parseInt(stringIndicesHoras.charAt(0));
			var indiceHoraFinal;
			if (stringIndicesHoras.length == 1) {
				indiceHoraFinal = indiceHoraInicial;
			} else {
				indiceHoraFinal = parseInt(stringIndicesHoras.charAt(stringIndicesHoras.length - 1));
			}
			
			if (turno == 'T') {
				indiceHoraInicial += 10;
				indiceHoraFinal += 10;
			} else if (turno == 'N') {
				indiceHoraInicial += 20;
				indiceHoraFinal += 20;
			}
		
			var horaInicial = 7 + Math.floor(indiceHoraInicial / 2);
			if (indiceHoraInicial % 2 == 0) {
				horaInicial = horaInicial + ":" + "00";
			} else {
				horaInicial = horaInicial + ":" + "30";
			}
			var horaFinal = 8 + Math.floor(indiceHoraFinal / 2);
			if (indiceHoraFinal % 2 == 0) {
				horaFinal = horaFinal + ":" + "00";
			} else {
				horaFinal = horaFinal + ":" + "30";
			}
			return horaInicial + " - " + horaFinal;
		},
		
		/**
		 * Formata horários separados por espaço. Exemplo: com a entrada "3T46 5T4" a 
		 * saída será "3T46 5T4 <br/> Ter <br/> 14:00 - 16:00 <br/> Qui <br/> 14:00 - 15:00"
		 */
		formatarHorarios: function(tdHorario) {
        	var horarios = tdHorario.innerHTML;
	        if (!horarios || horarios.length == 0 || !this.REGEX_HORARIO.test(horarios)) {
	            return;
	        }
	        var horariosFormatado = "";
	        tdHorario.style.textAlign = "center";
	
	        var arrayHorarios = horarios.split(" "); //Transforma a string em array de strings
	        for (var i = 0; i < arrayHorarios.length; i++) {
	            var h = arrayHorarios[i].replace(/^[ ]$/g, ""); //Remove os espaços
	            if (h.length && this.REGEX_HORARIO.test(h)) {
		            var partes = this.REGEX_HORARIO.exec(h);
		            var dias = this.formatarDias(partes[1]);
		            var turno = partes[2];
		            var horas = this.formatarHoras(partes[3], turno);
		            
		            dias = "<span class='sigaa_facil_dias'>" + dias + "</span>"; 
		            horas = "<span class='sigaa_facil_horas'>" + horas + "</span>";
		            horariosFormatado += dias + "<br/>" + horas + "<br/>";
	            }
	        }
	        tdHorario.innerHTML = horariosFormatado + "<div class='sigaa_facil_separador'></div>" + tdHorario.innerHTML;
		},
		
		run: function (event) {
			var doc = event.originalTarget;
			//var doc = content.document;
			
			//Valida se o site atual é o SIGAA:
			if (doc.location.href == 'about:blank' ||
					doc.title.toUpperCase().indexOf("SIGAA") == -1) {
				return;
			}
			
			//Se a detecção do SIGAA estiver sendo restringida por domínios, efetua a verificação de domínio:
			var restingirDominios = prefManager.getBoolPref("extensions.sigaafacil.restringir-dominios");
			if (restingirDominios) {
				var dominios = prefManager.getCharPref("extensions.sigaafacil.lista-dominios").replace(/[ ]/g, "").split("\n");
				var dominioOK = false;
				for (var i = 0; i < dominios.length; i++) {
					if (doc.location.href.indexOf(dominios[i]) != -1) {
						dominioOK = true;
						break;
					}
				}
				if (!dominioOK) {
					// alert("O site atual parece ser do SIGAA, mas não está na lista de domínios");
					return;
				}
			}
			
			// Inicia o processo de substituição dos horários na tabela de turmas:
			try {
				//Procura as possíveis tabelas que contém coluna de horário:
				var table = doc.getElementById("lista-turmas");
				table = (table == null) ? doc.getElementById("lista-turmas-curriculo") : table;
				table = (table == null) ? doc.getElementById("lista-turmas-extra") : table;
				
				if (table == null) {
					//Verifica se possui a tabela de turmas selecionadas (matrícula concluída):
					var tableMatriculaConcluida = doc.getElementsByClassName("listagem");
					if (tableMatriculaConcluida.length && 
							tableMatriculaConcluida[0].caption.innerHTML.toLowerCase().indexOf("turmas selecionadas") != -1) {
						table = tableMatriculaConcluida[0];
					} else {
						//alert("Esta página não parece conter horários");
						return;
					}
				}
				
				//Se achou uma tabela que possui possivelmente uma coluna de horários, efetua a busca pela coluna:
				var tableHead = table.getElementsByTagName("thead")[0];
				var headCols = tableHead.getElementsByTagName("td");
				if (headCols == null || headCols.length == 0) {
					headCols = tableHead.getElementsByTagName("th");
				}
				
				var existeTDHorario = false;
				// Procura índice da coluna da tabela que contém os horários
				var spanTDHorario = 0;
				const REGEX_HORARIO = /hor[aá]rio/i; //O modificador 'i' ao final indica case-insensitive matching
				for (var i = 0; i < headCols.length; i++) {
					var td = headCols[i];
					spanTDHorario += td.colSpan;
					if (td.innerHTML && REGEX_HORARIO.test(td.innerHTML)) {
						existeTDHorario = true;
						break;
					}
				}
				//Verifica se encontrou a coluna <td> de Horário:
				if (!existeTDHorario) {
					return;
				}

				if (!this.addStylesheet(doc)) {
					// Se já adicionou o stylesheet, os horários já estão formatados
					return;
				}
				
				var tableBodies = table.tBodies;
				for (var j = 0; j < tableBodies.length; j++) {
					var tableBody = tableBodies[j];
					var tableRows = tableBody.rows;
					
					for (var i = 0; i < tableRows.length; i++) {
						var row = tableRows[i];
						var cols = row.getElementsByTagName("td");
						//Procura pela coluna referente à coluna Horário encontrada no cabeçalho
						//Esta busca é necessária devido ao uso de atributos colspan > 1 em <TD> 
						var indiceAtualTDHorario = 0;
						var qtdAtualSpanAtualTDHorario = 0;
						for (var k = 0; k < cols.length; k++) {
							qtdAtualSpanAtualTDHorario += cols[k].colSpan;
							if (qtdAtualSpanAtualTDHorario == spanTDHorario) {
								indiceAtualTDHorario = k;
								break;
							}
						}
						
		                var tdHorario = cols[indiceAtualTDHorario];
						this.formatarHorarios(tdHorario);
					}
				}
			} catch (ex) {
				// alert("SIGAA Fácil - Erro: " + ex.description);
			}
		}
	};
}();
window.addEventListener("load", sigaafacil.init, false);