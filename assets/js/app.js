	
	function arrayColumn(arr, n) {
	  return arr.map(x=> x[n]);
	}
			
	function argmin(a) {
		return a.reduce(function(lowest, next, index) {return next < a[lowest] ? index : lowest; }, 0);
	}
	function argmax(a) {
		return a.reduce(function(highest, next, index) {return next > a[highest] ? index : highest; }, 0);
	}


	/////////////////////////////////////////////////////////////////////////////////////	
	
	var simulator = new Worker("./assets/js/simulate.js");
	simulator.onmessage = function(event){
		
		var sim_data = event.data;
		update_simplots(assets, sim_data, total_amount);
		
		$("#simulate").removeAttr('disabled');
		$("#sim-loading").hide();
		$("#sim-available").show();
		
	};
	//////////////////////////////////////////////////////////////////////
	
	function update_simplots(stocks, sim_data, total_amount){
		
		[returns, risks, sharpes, portfolios, stock_counts] = sim_data;
		
		var N = stocks.length;
		var allocate = (total_amount != 0);
		//////////////////////////////////////////////////////////////////////
		//////////////////////////Pareto Plot//////////////////////////
		//////////////////////////////////////////////////////////////////////
		function weight_label(weight_arr){
			return JSON.stringify(math.round(math.multiply(weight_arr, 100), 1));
		}
		
		function count_label(count_arr){
			return JSON.stringify(count_arr);
		}
		
		//TBD add sharpe ratios to this
		var pareto_labels = [];
		if (allocate == false){
			pareto_labels = portfolios.map(weight_label);
		}else{
			pareto_labels = stock_counts.map(count_label);
		}
		
		var mc_points = {
		  name: "Portfolios",
		  x: risks,
		  y: returns,
		  mode: 'markers',
		  type: 'scatter',
		  text: pareto_labels, 
		  marker: {
			color: 'rgba(190, 190, 255, 1)',
			size: math.round(math.dotMultiply(sharpes, 5))
		  }
		};
		
		var min_risk_index = argmin(risks);
		var max_sharpe_index = argmax(sharpes);
		
		var min_risk = {
		  name: "Min Risk",
		  x: [risks[min_risk_index]],
		  y: [returns[min_risk_index]],
		  mode: 'markers',
		  type: 'scatter',
		  text: weight_label(portfolios[min_risk_index])+"</br>"+"Sharpe: "+math.round(sharpes[min_risk_index], 3),
		  marker: {
			color: 'rgba(0,0,0,0)',
			size: 20,
			line: {
			  color: 'rgb(130, 40, 255)',
			  width: 2
			}
		  },
		}; 
		
		
		var max_sharpe = {
		  name: "Max Sharpe",
		  x: [risks[max_sharpe_index]],
		  y: [returns[max_sharpe_index]],
		  mode: 'markers',
		  type: 'scatter',
		  text: weight_label(portfolios[max_sharpe_index])+"</br>"+"Sharpe: "+math.round(sharpes[max_sharpe_index], 3),
		  marker: {
			color: 'rgba(0,0,0,0)',
			size: 20,
			line: {
			  color: 'rgb(13, 40, 255)',
			  width: 2
			}
		  },
		}; 

		
		var data = [mc_points, min_risk, max_sharpe];
		var layout = {autosize: false, width: 720, height: 640, xaxis:{title: "Expected Risk/Volatility"}, yaxis:{title: "Expected Return"}};
		Plotly.newPlot('pareto-plot', data, layout);
		$('#pareto-plot').show();

		///////////////////////////////////////////////////////////////
		//////////////////Parallel Plot//////////////////////////
		///////////////////////////////////////////////////////////////
		var parallel_data = [];
		if (allocate == false){
			parallel_data = portfolios;
		}else{
			parallel_data = stock_counts;
		}
		
		var dims = [];
		for (var i=0; i<N; i++){
			var dim = {
				values: arrayColumn(parallel_data, i),
				label: stocks[i]
			}
			dims.push(dim);
		}
		
		var data = [{
		  type: 'parcoords',
		  pad: [80,80,80,80],
		  line: {
			showscale: true,
			color: sharpes,
			colorscale: [[0, 'red'], [0.5, 'green'], [1, 'blue']],
			cmax: 1.7,
			cmin: 0.5,
			
		  },
		  dimensions: dims
		}];
		
		
		var layout = {autosize: false, width: 640, height: 640};
		Plotly.newPlot('parallel-plot', data, layout);
		$('#parallel-plot').show();
	}
	
	function data_plot(timestamps, data, stocks){
		//////////////////////////////////////////////////////////////////////
		/////////////////////////Timeseries Plot//////////////////////////////
		//////////////////////////////////////////////////////////////////////
		var N = stocks.length;
		
		var traces = [];
		for (var i=0; i < N; i++){
			var trace = {
				type: "scatter",
				mode: "lines",
				x: timestamps,
				y: data[i],
				name: stocks[i]
			}
			traces.push(trace);
		}
		
		var layout = {autosize: false, width: 1280, height: 640, xaxis: {type: 'date'}};
		Plotly.newPlot('timeseries-plot', traces, layout);
		$('#timeseries-plot').show();
	}
	/////////////////////////////////////////////////////////////////////////////////////	
	var timestamps = [];
	var main_data = [];
	var assets = [];
	var total_amount = 0;
	
	$( document ).ready(function() {
		
		$('[data-toggle="tooltip"]').tooltip();
		$(".plot").hide();
		$("#simulate").hide();
		$("#sim-loading").hide();
		$("#go-loading").hide();
		
		$("#go").click(function(){
			$("#simulate").hide();
			$("#go-loading").show();
			
			//reset clear old data
			timestamps = [];
			main_data = [];
			assets = [];
			
			//console.log($('#tickers').val());
			console.log($('#tickers').tagsinput('items'));
			
			var params = {stocks: $('#tickers').tagsinput('items')};
			$.ajax({
				url: "https://mpt.amshenoy1.repl.co/api/data",
				type: "post",
				dataType: 'json',
				contentType: 'application/json',
				data: JSON.stringify(params),
				success: function (data) {

					assets = data["columns"];
					timestamps = data["index"];
					// Convert row arrays to column arrays
					for (var i=0; i < data["columns"].length; i++){
						main_data.push(arrayColumn(data["data"], i));
					}
					
					data_plot(timestamps, main_data, assets);
					
					$("#simulate").show();
					$("#go-loading").hide();
				}
			});
			
			
		});
		
		$("#simulate").click(function(){
			$("#simulate").attr('disabled', 'disabled');
			$("#sim-loading").show();
			$("#sim-available").hide();
			
			total_amount = parseInt($("#total").val());
			var prune = $("#prune").is(":checked");
			var free_rate = $("#free-rate").val() / 100; // free interest growth

			
			//var sim_data = simulate(assets, main_data, free_rate, total_amount, prune);		
			simulator.postMessage([assets, main_data, free_rate, total_amount, prune]);		
		});

	});