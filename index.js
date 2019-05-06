const axios = require('axios');
const forEachAsync = require('forEachAsync').forEachAsync;

let rodada_atual;
let ratings = [];
let clubes = [];
let rodadas = [];
axios({
    method: 'get',
    url: 'https://api.cartolafc.globo.com/mercado/status',
    responseType: 'json'
}).then((response) => {
    if(response.data.status_mercado !== 1) process.exit(1);
    console.log("Mercado aberto.");
    rodada_atual = response.data.rodada_atual;

    axios({
        method: 'get',
        url: 'https://api.cartolafc.globo.com/clubes',
        responseType: 'json'
    }).then((response) => {
        clubes = response.data;
        for (let i = 1; i <= rodada_atual; i++) {
            rodadas.push({ [i]: { rodada: i }})
        }
        forEachAsync(rodadas, (next, rod, index) => {
            axios({
                method: 'get',
                url: 'https://api.cartolafc.globo.com/partidas/'+(rod[((index + 1).toString())].rodada),
                responseType: 'json'
            }).then((response) => {
                rodadas[index][((index + 1).toString())] = response.data;
                next(next);
            }).catch((err) => {
                console.log("Algo deu errado manito.")
                process.exit(1)
            });
        }).then(() => {
            startBuilding()
        })
    });
});

let getDados = (playerid, cb) => {
    axios({
        method: 'get',
        url: 'https://api.cartolafc.globo.com/auth/mercado/atleta/'+playerid+'/pontuacao',
        responseType: 'json',
        headers: {
            "X-GLB-Token": "121be535c10f89ef0b1b09c8d259732294e576a6e75493079595f6a484337504b6e4630346259313843586f735a7537565542714e38464d5445564b39726d74677879556963635944313655466a365f634b49523257457253395f4878304c697a6d50465f52413d3d3a303a757666687573796b7373646f616f6c6778727870"
        }
    }).then((response) => {
        return cb(response.data)
    }).catch((err) => {
        console.log(err);
    });
}

let getTimeClass = (teamId, rodada, cb) => {
    let response = rodadas[(rodada - 1)][(rodada.toString())];
    let posicao_ad, posicao_prop, diff;
    response.partidas.forEach((data) => {
        if(data.clube_casa_id === teamId) {
            posicao_ad = data.clube_casa_posicao
            posicao_prop = data.clube_visitante_posicao
        }
        if(data.clube_visitante_id === teamId) {
            posicao_ad = data.clube_visitante_id
            posicao_prop = data.clube_casa_posicao
        }
    })
    diff = Math.abs(posicao_ad - posicao_prop);
    if(diff > 10) return cb(1.5)
    if(diff > 5 && diff <= 10) return cb(1.3)
    if(diff <= 5) return cb(1)
}

let getLastThreeGamesClass = (teamId, cb) => {

    getLastThreeGames(teamId, (primeiro, segundo, terceiro) => {
        getTimeClass(primeiro, (rodada_atual - 1), classUm => {
            getTimeClass(segundo, (rodada_atual - 2), classDois => {
                return cb(classUm, classDois)
                /*getTimeClass(terceiro, (rodada_atual - 3), classTres => {
                    cb(classUm, classDois, classTres)
                })*/
            })
        })
    })

}

let getLastThreeGames = (teamId, cb) => {
    getAgainst(teamId, (rodada_atual - 1), primeiro => {
        getAgainst(teamId, (rodada_atual - 2), segundo => {
            return cb(primeiro, segundo)
            /*getAgainst(teamId, (rodada_atual - 3), terceiro => {
                cb(primeiro, segundo, terceiro);
            })*/
        })
    })
}

let getAgainst = (teamId, rodada, cb) => {
    let response = rodadas[(rodada - 1)][(rodada.toString())];
    response.partidas.forEach((data) => {
        if(data.clube_casa_id === teamId) return cb(data.clube_visitante_id)
        if(data.clube_visitante_id === teamId) return cb(data.clube_casa_id)
    })
}

function sortFunction(a, b) {
    if (a['rating_final'] === b['rating_final']) 
        return 0;
    else 
        return (a['rating_final'] < b['rating_final']) ? -1 : 1;
}

function fil(pos) {
    return function(val) {
        return val.posicao_id === pos;
    };
}


let startBuilding = () => {
    console.log("Iniciando analise...")
    axios({
        method: 'get',
        url: 'https://api.cartolafc.globo.com/atletas/mercado',
        responseType: 'json'
    }).then((response) => {
        console.log("Carregando todos os atletas...")
        forEachAsync(response.data.atletas, (next, jog, i) => {
            if(jog.media_num === 0) return next(next)
            if(jog.status_id !== 7) return next(next)

            getDados(jog.atleta_id, (dados) => {
                getLastThreeGamesClass(jog.clube_id, (ultima, penultuma) => {
                    let rating1, rating2;
                    let varias = []
                    if(dados[rodada_atual - 2].pontos > 0) rating1 = (dados[rodada_atual - 2].pontos) * ultima;
                    else rating1 = (dados[rodada_atual - 2].pontos) / ultima;

                    if(dados[rodada_atual - 2].pontos > 0) rating2 = (dados[rodada_atual - 3].pontos) * penultuma;
                    else rating2 = (dados[rodada_atual - 3].pontos) / penultuma;
                    
                    let rating_final;

                    if(rating1 === 0) {
                        varias.push("Não jogou")
                        rating_final = rating2 * 0.7; //perde 30% por n ter tido um dos jogos
                    }else if(rating2 === 0){
                        varias.push("Não jogou")
                        rating_final = rating1 * 0.7;  //perde 30% por n ter tido um dos jogos
                    } 
                    else rating_final = (rating1 + rating2) / 2; //media das 2 ratings

                    if((rating1 !== 0 && rating2 !== 0) && ((rating1 > rating2 && penultuma > ultima) || rating2 > rating1 && ultima > penultuma)) {
                        rating_final = rating_final * 0.6; //perde jogo facil mas ganha dificil, perde 40%
                        varias.push("Perde fácil, ganha difícil")
                    }

                    if(jog.preco_num > 10 && jog.preco_num < 14) {
                        rating_final = rating_final * 0.7; //Jogador muito caro, perde 30%
                        varias.push("Muito caro")
                    }

                    if(jog.preco_num > 14) {
                        rating_final = rating_final * 0.5; //Jogador muito caro, perde 50%
                        varias.push("Extremamente caro")
                    }


                    let diff = Math.abs(rating2 - rating1); //Muita variação, perde 30%
                    if(diff > (rating_final * 1.3)) {
                        varias.push("Variação")
                        rating_final = rating_final * 0.7;
                    } 

                    console.log("Progresso: "+(((i * 100) / response.data.atletas.length).toFixed(2)))

                    getTimeClass(jog.clube_id, rodada_atual, (clas) => {
                        rating_final = rating_final / clas;

                        let dif;
                        if(clas === 1.5) dif = "Difícil"
                        if(clas === 1.3) dif = "Mediano"
                        if(clas === 1) dif = "Fácil"

                        ratings.push({
                            id: jog.atleta_id,
                            nome: jog.apelido,
                            time: clubes[jog.clube_id].nome,
                            posicao_id: jog.posicao_id,
                            dificuldade: dif,
                            preco: jog.preco_num,
                            varia: varias,
                            rating1: {
                                multiplier: ultima,
                                rating: rating1.toFixed(2),
                                pontos: dados[rodada_atual - 2].pontos
                            },
                            rating2: {
                                multiplier: penultuma,
                                rating: rating2.toFixed(2),
                                pontos: dados[rodada_atual - 3].pontos
                            },
                            rating_final: rating_final
                        })
                        
                        next(next);
                    })
                })
            });
        }).then(() => {
            console.log("Todas as ratings foram calculadas.")
            ratings.sort(sortFunction);
            ratings.reverse();
            let Goleiro = ratings.filter(fil(1)).splice(0, 1);
            let Zagueiro = ratings.filter(fil(3)).splice(0, 2);
            let Lateral = ratings.filter(fil(2)).splice(0, 2);
            let Meia = ratings.filter(fil(4)).splice(0, 4);
            let Atacante = ratings.filter(fil(5)).splice(0, 2);
            let Técnico = ratings.filter(fil(6)).splice(0, 1);
            console.log("Goleiros: ")
            console.log(Goleiro)
            console.log("Zagueiro: ")
            console.log(Zagueiro)
            console.log("Lateral: ")
            console.log(Lateral)
            console.log("Meia: ")
            console.log(Meia)
            console.log("Atacante: ")
            console.log(Atacante)
            console.log("Técnico: ")
            console.log(Técnico)
            console.log("Capitão: ")
            console.log(ratings[0])

            let total_price = Goleiro.splice(0, 1)[0].preco;

            for (let i = 0; i < Zagueiro.length; i++) total_price += Zagueiro[i].preco;  
            for (let i = 0; i < Lateral.length; i++) total_price += Lateral[i].preco;  
            for (let i = 0; i < Meia.length; i++) total_price += Meia[i].preco;  
            for (let i = 0; i < Atacante.length; i++) total_price += Atacante[i].preco;  
            for (let i = 0; i < Técnico.length; i++) total_price += Técnico[i].preco;  

            console.log("Preço total do time: "+total_price);
        })
            
    }).catch((err) => {
        console.log(err);
    });
};

