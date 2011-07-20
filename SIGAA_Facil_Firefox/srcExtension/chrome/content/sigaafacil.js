var sigaafacil = function () {
	var prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	return {
		init : function () {
			gBrowser.addEventListener("load", function () {
				var autoRun = prefManager.getBoolPref("extensions.sigaafacil.autorun");
				if (autoRun) {
					sigaafacil.run();
				}
			}, true);
		},
		
		/**
		 * Adiciona o arquivo de estilos utilizado pelo SIGAA Fácil na página
		 */
		addStylesheet: function() {
			var head = content.document.getElementsByTagName("head")[0],
			style = content.document.getElementById("sigaafacil_style");
		
			if (!style) {
				style = content.document.createElement("link");
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
				diasFormatado += sigaafacil.TABELA_DIAS[parseInt(dias[i])];
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
		formatarHorarios: function(horarios) {
		        if (!horarios || horarios.length == 0) {
		            return horario;
		        }
		        var horariosFormatado = "";
		
		        var arrayHorarios = horarios.split(" "); //Transforma a string em array de strings
		        for (var i = 0; i < arrayHorarios.length; i++) {
		            var h = arrayHorarios[i].replace(/[ ]/g, ""); //Remove os espaços
		            if (h.length && this.REGEX_HORARIO.test(h)) {
			            var partes = this.REGEX_HORARIO.exec(h);
			            var dias = sigaafacil.formatarDias(partes[1]);
			            var turno = partes[2];
			            var horas = sigaafacil.formatarHoras(partes[3], turno);
			            
//			            dias = dias.fontcolor("#095E11");
//			            horas = horas.fontcolor("#7D6913");
			            dias = "<span class='sigaa_facil_dias'>" + dias + "</span>"; 
			            horas = "<span class='sigaa_facil_horas'>" + horas + "</span>";
			            horariosFormatado += dias + "<br/>" + horas + "<br/>";
		            }
		        }
			return horariosFormatado + "<div class='sigaa_facil_separador'></div>" + horarios;
		},
		
		run: function () {
			try {
				var doc = content.document;
	
				//Valida se o site atual é o SIGAA:
				if (doc.title.toUpperCase().indexOf("SIGAA") == -1) {
					return;
				}
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
				var table = content.document.getElementById("lista-turmas");
				if (table == null) {
					//alert("Esta página não parece conter horários");
					return;
				}
				
				// Inicia o processo de substituição dos horários na tabela de turmas:
				var tableHead = table.getElementsByTagName("thead")[0];
				var headCols = tableHead.getElementsByTagName("td");
				if (headCols == null || headCols.length == 0) {
					headCols = tableHead.getElementsByTagName("th");
				}
				
				// Procura índice da coluna da tabela que contém os horários
				var indiceTDHorario = null;
				for (var i = 0; i < headCols.length; i++) {
					var th = headCols[i];
					if (th.innerHTML && th.innerHTML.toLowerCase().match("hor.rio")) {
						indiceTDHorario = i;
					}
				}
				if (indiceTDHorario == null) {
					return;
				}
				var tableBody = table.getElementsByTagName("tbody")[0];
				var tableRows = tableBody.getElementsByTagName("tr");
				
				if (!sigaafacil.addStylesheet()) {
					// Se já adicionou o stylesheet, os horários já estão formatados
					return;
				}
				for (var i = 0; i < tableRows.length; i++) {
					var row = tableRows[i];
					var cols = row.getElementsByTagName("td");
					if (cols.length > indiceTDHorario) {
		                var tdHorario = cols[indiceTDHorario];
		                tdHorario.style.textAlign = "center";
						tdHorario.innerHTML = sigaafacil.formatarHorarios(tdHorario.innerHTML);
					}
				}
			} catch (ex) {
				// alert("SIGAA Fácil - Erro: " + ex.description);
			}
		}
	};
}();
window.addEventListener("load", sigaafacil.init, false);